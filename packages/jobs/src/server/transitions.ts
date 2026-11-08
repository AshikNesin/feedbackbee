import { and, asc, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@groot/core/database";
import { Boom, reportError } from "@groot/core/errors";
import { logger } from "@groot/core/logger";
import { JOB_ACTIONS, canApplyJobAction, type JobAction, type JobState } from "../lifecycle";
import { defaultJobOptions } from "./config";
import { createJobLogger, deleteJobLogs, flushJobLogs } from "./logger";
import { jobs, type Job, type NewJob } from "./schema";
import type { SendJobOptions } from "./types";

/**
 * Job transitions: every write that creates a job row or moves one between
 * states. `enqueue` is the only place that inserts into `jobs`; `apply` runs
 * one event (an operator action from `../lifecycle`, or a tick outcome) as a
 * single compare-and-set `UPDATE … RETURNING`, so a racing writer is never
 * overwritten and no transaction is needed (D1 has none).
 *
 * The module also owns the one retry policy (a handler failure and an
 * active-timeout both back off, log and report the same way), the
 * not-found and wrong-state errors, and the inline-tick nudge: every event
 * that lands a job in `created` with `runAt <= now` calls `onDue(job)`. The
 * runner (`tick.ts`) supplies `onDue`; use the queue functions or
 * `jobRunner.transitions` rather than building your own.
 */

/** What `enqueue` inserts: a name, its payload and the `addJob()` options. */
export interface EnqueueSpec extends SendJobOptions {
  name: string;
  data: unknown;
}

/** An operator action, exactly the ones `../lifecycle` defines. */
export interface JobOperatorEvent {
  type: JobAction;
}

/**
 * What the tick reports about a claimed (`active`) job. `fail` and `timeout`
 * share the retry policy; `timeout` is a job left `active` past
 * `config.jobs.activeTimeoutSeconds` (its process crashed or hung).
 */
export type JobTickEvent =
  | { type: "succeed"; output?: unknown }
  | { type: "fail"; error: unknown; durationMs?: number }
  | { type: "timeout" };

export interface JobTransitions {
  /**
   * Insert a `created` job and return its row. With a `singletonKey` that a
   * `created` or `active` job of the same name already holds, return that
   * job instead.
   */
  enqueue(spec: EnqueueSpec): Promise<Job>;
  /**
   * Apply an operator action and return the row it produced: the updated
   * job, the deleted row (`delete`) or the new copy (`rerun`). Throws `404`
   * (`JOB_NOT_FOUND`) for an unknown id and `400` (`JOB_ACTION_NOT_ALLOWED`)
   * when the job's state does not allow the action.
   */
  apply(target: string | Job, event: JobOperatorEvent): Promise<Job>;
  /**
   * Record a tick outcome for a job this tick claimed. Returns the updated
   * row, or null when the job moved on meanwhile (cancelled, deleted, or
   * recovered by another process); the job's logs go with a deleted job.
   */
  apply(job: Job, event: JobTickEvent): Promise<Job | null>;
  /** Move up to `limit` due `created` jobs named in `names` to `active`, highest priority first. */
  claim(names: readonly string[], limit: number, now?: Date): Promise<Job[]>;
}

/** Retries back off from `retryDelay` seconds, doubling per attempt, to at most this. */
export const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

/** The message stored on a job that timed out while `active`. */
export const JOB_TIMEOUT_ERROR = "Timed out while active";

export function assertJobName(name: string): void {
  if (!name) {
    throw Boom.badRequest(`Invalid job name: ${name}`, null, "JOB_NAME_INVALID");
  }
}

export function jobNotFound(jobId: string) {
  return Boom.notFound(`Job not found: ${jobId}`, null, "JOB_NOT_FOUND");
}

export function jobActionNotAllowed(action: JobAction, state: JobState) {
  return Boom.badRequest(
    `Cannot ${action} a ${state} job (allowed from: ${JOB_ACTIONS[action].join(", ")})`,
    null,
    "JOB_ACTION_NOT_ALLOWED",
  );
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job ?? null;
}

/**
 * The retry policy, for a handler failure and a timeout alike: while
 * `retryCount < retryLimit` the job goes back to `created` with `runAt = now
 * + retryDelay × 2^retryCount` seconds (capped at `MAX_RETRY_DELAY_MS`) and
 * `retryCount + 1`; after that it is `failed`.
 */
export function afterFailedAttempt(
  job: Pick<Job, "retryCount" | "retryLimit" | "retryDelay">,
  error: string,
  now: Date,
): Partial<NewJob> {
  if (job.retryCount < job.retryLimit) {
    const delayMs = Math.min(job.retryDelay * 1000 * 2 ** job.retryCount, MAX_RETRY_DELAY_MS);
    return {
      state: "created",
      startedAt: null,
      runAt: new Date(now.getTime() + delayMs),
      retryCount: job.retryCount + 1,
      error,
    };
  }
  return { state: "failed", completedAt: now, error };
}

/** What each lifecycle action that updates the row in place writes. */
const OPERATOR_UPDATES: Record<"retry" | "resume" | "cancel", (now: Date) => Partial<NewJob>> = {
  retry: (now) => ({
    state: "created",
    runAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
  }),
  resume: (now) => ({ state: "created", runAt: now, completedAt: null }),
  cancel: (now) => ({ state: "cancelled", completedAt: now }),
};

function serializable(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The attempt the tick claimed: still `active`, and not re-claimed since. */
function sameAttempt(job: Job) {
  return and(
    eq(jobs.id, job.id),
    eq(jobs.state, "active"),
    job.startedAt ? eq(jobs.startedAt, job.startedAt) : isNull(jobs.startedAt),
  );
}

function isTickEvent(event: JobOperatorEvent | JobTickEvent): event is JobTickEvent {
  return event.type === "succeed" || event.type === "fail" || event.type === "timeout";
}

/** Build the transitions; `onDue` runs for every job an event lands in `created` and due. */
export function createJobTransitions(onDue: (job: Job) => void): JobTransitions {
  function landed(job: Job): Job {
    if (job.state === "created" && job.runAt.getTime() <= Date.now()) onDue(job);
    return job;
  }

  async function enqueue(spec: EnqueueSpec): Promise<Job> {
    assertJobName(spec.name);
    const defaults = defaultJobOptions();

    if (spec.singletonKey) {
      const [existing] = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.name, spec.name),
            eq(jobs.singletonKey, spec.singletonKey),
            inArray(jobs.state, ["created", "active"]),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }

    const [job] = await db
      .insert(jobs)
      .values({
        id: crypto.randomUUID(),
        name: spec.name,
        data: spec.data ?? null,
        state: "created",
        priority: spec.priority ?? defaults.priority,
        retryLimit: spec.retryLimit ?? defaults.retryLimit,
        retryDelay: spec.retryDelaySeconds ?? defaults.retryDelaySeconds,
        runAt: spec.runAt ?? new Date(Date.now() + (spec.delaySeconds ?? 0) * 1000),
        singletonKey: spec.singletonKey ?? null,
      })
      .returning();
    logger.info({ jobId: job!.id, name: spec.name }, "Job queued");
    return landed(job!);
  }

  /**
   * One compare-and-set UPDATE from the states `action` is allowed from. When
   * no row changes, a follow-up read tells "not found" from "wrong state".
   */
  async function update(
    action: "retry" | "resume" | "cancel",
    jobId: string,
    set: Partial<NewJob>,
  ): Promise<Job> {
    const [changed] = await db
      .update(jobs)
      .set(set)
      .where(and(eq(jobs.id, jobId), inArray(jobs.state, [...JOB_ACTIONS[action]])))
      .returning();
    if (changed) return landed(changed);
    const job = await getJobById(jobId);
    if (!job) throw jobNotFound(jobId);
    throw jobActionNotAllowed(action, job.state);
  }

  async function applyOperator(jobId: string, action: JobAction): Promise<Job> {
    switch (action) {
      case "delete": {
        const [deleted] = await db.delete(jobs).where(eq(jobs.id, jobId)).returning();
        if (!deleted) throw jobNotFound(jobId);
        // An active job's handler may still log; the tick drops those rows when it finishes.
        await deleteJobLogs([jobId]);
        return deleted;
      }
      case "rerun": {
        const job = await getJobById(jobId);
        if (!job) throw jobNotFound(jobId);
        if (!canApplyJobAction("rerun", job.state)) throw jobActionNotAllowed("rerun", job.state);
        return enqueue({
          name: job.name,
          data: job.data,
          priority: job.priority,
          retryLimit: job.retryLimit,
          retryDelaySeconds: job.retryDelay,
        });
      }
      default:
        return update(action, jobId, OPERATOR_UPDATES[action](new Date()));
    }
  }

  /**
   * Write a tick outcome while the claimed attempt is still current. A job
   * deleted mid-run has no row left to own the logs its handler wrote after
   * the delete, so they go too.
   */
  async function finish(job: Job, set: Partial<NewJob>): Promise<Job | null> {
    const [updated] = await db.update(jobs).set(set).where(sameAttempt(job)).returning();
    if (updated) return updated;
    if (!(await getJobById(job.id))) await deleteJobLogs([job.id]);
    return null;
  }

  /**
   * The one failure path. The error line is persisted before the state
   * changes, so a dashboard that sees the new state also sees why; the error
   * is reported only by the writer that won the compare-and-set.
   */
  async function failAttempt(
    job: Job,
    error: unknown,
    cause: "failed" | "timed out",
    durationMs?: number,
  ): Promise<Job | null> {
    const attempt = job.retryCount + 1;
    const jobLogger = createJobLogger({ jobId: job.id, jobName: job.name });
    jobLogger.error(
      { err: error, attempt, ...(durationMs === undefined ? {} : { duration: `${durationMs}ms` }) },
      `Job ${job.name} ${cause}`,
    );
    await flushJobLogs();
    const next = await finish(job, afterFailedAttempt(job, errorMessage(error), new Date()));
    if (!next) return null;
    reportError(error, { component: "jobs", jobName: job.name, jobId: job.id, attempt });
    return landed(next);
  }

  async function applyTick(job: Job, event: JobTickEvent): Promise<Job | null> {
    switch (event.type) {
      case "succeed":
        return finish(job, {
          state: "completed",
          completedAt: new Date(),
          output: serializable(event.output),
          error: null,
        });
      case "fail":
        return failAttempt(job, event.error, "failed", event.durationMs);
      case "timeout":
        return failAttempt(job, new Error(JOB_TIMEOUT_ERROR), "timed out");
    }
  }

  function apply(target: string | Job, event: JobOperatorEvent): Promise<Job>;
  function apply(job: Job, event: JobTickEvent): Promise<Job | null>;
  function apply(target: string | Job, event: JobOperatorEvent | JobTickEvent) {
    if (isTickEvent(event)) {
      if (typeof target === "string") throw new TypeError("A tick event needs the claimed job row");
      return applyTick(target, event);
    }
    return applyOperator(typeof target === "string" ? target : target.id, event.type);
  }

  async function claim(names: readonly string[], limit: number, now = new Date()): Promise<Job[]> {
    if (names.length === 0 || limit <= 0) return [];

    const due = db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.state, "created"), lte(jobs.runAt, now), inArray(jobs.name, [...names])))
      .orderBy(desc(jobs.priority), asc(jobs.runAt), asc(jobs.createdAt))
      .limit(limit);

    const claimed = await db
      .update(jobs)
      .set({ state: "active", startedAt: now })
      .where(and(eq(jobs.state, "created"), inArray(jobs.id, due)))
      .returning();

    // RETURNING does not preserve the subquery's ORDER BY; run high priority first.
    return claimed.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.runAt.getTime() - b.runAt.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  return { enqueue, apply, claim };
}
