import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { Cron } from "croner";
import { db } from "@groot/core/database";
import { config } from "@groot/core/config";
import { logger, logPerformance, waitUntil } from "@groot/core/logger";
import { reportError } from "@groot/core/errors";
import { kv, purgeExpiredKv } from "@groot/core/kv";
import { jobs, jobSchedules, type Job } from "./schema";
import { createJobLogger, deleteJobLogs, flushJobLogs } from "./logger";
import { createJobTransitions, type JobTransitions } from "./transitions";
import type { JobHandler, TickOptions, TickResult } from "./types";

/**
 * The job runner. One pass over the queue (a tick): enqueue due schedules,
 * recover crashed jobs, claim a batch, run it, clean up. Called by the Node
 * poller every few seconds, by the Workers cron trigger every minute, and
 * inline whenever a transition lands a job in `created` and due.
 */

const HOUSEKEEPING_INTERVAL_MS = 10 * 60 * 1000;
/** How long to wait before asking again after another process held the slot. */
const HOUSEKEEPING_RECHECK_MS = 60 * 1000;
const HOUSEKEEPING_KEY = "jobs:housekeeping:lastRunAt";

/**
 * When this process next asks for the housekeeping slot. Per process, next to
 * the kv claim that reads it; `JobRunner.reset()` clears it.
 */
let nextHousekeepingCheck = 0;

/** The inline tick: run what is due now, skip schedules and housekeeping. */
const INLINE_TICK: TickOptions = { schedules: false, housekeeping: false };

function emptyResult(): TickResult {
  return { scheduled: 0, claimed: 0, completed: 0, retried: 0, failed: 0 };
}

/**
 * Owns all runner state: the handler registry, the in-flight tick and its
 * re-run request, the Node poll timer, and the job transitions wired to nudge
 * this runner. `jobRunner` is the process-wide instance every queue function
 * and the Workers cron use; tests call `jobRunner.reset()` for fresh state.
 */
export class JobRunner {
  /** Every job write goes through these; a due `created` job nudges an inline tick. */
  readonly transitions: JobTransitions = createJobTransitions((job) => this.#nudge(job));

  readonly #handlers = new Map<string, JobHandler>();
  #inFlight: Promise<TickResult> | null = null;
  #rerunRequested = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  /** Register (or replace) the handler for `name`. */
  register<T, R = unknown>(name: string, handler: JobHandler<T, R>): void {
    this.#handlers.set(name, handler as JobHandler);
    logger.debug({ jobName: name }, "Job handler registered");
  }

  handler(name: string): JobHandler | undefined {
    return this.#handlers.get(name);
  }

  handlerNames(): string[] {
    return [...this.#handlers.keys()];
  }

  /**
   * Run one tick. While a tick is running, return it and ask for one more
   * pass after it, so a job that became due mid-tick does not wait for the
   * next poll.
   */
  runTick(options: TickOptions = {}): Promise<TickResult> {
    if (this.#inFlight) {
      this.#rerunRequested = true;
      return this.#inFlight;
    }
    this.#inFlight = this.#tick(options)
      .catch((error: unknown) => {
        logger.error({ err: error }, "Job tick failed");
        reportError(error, { component: "jobs" });
        return emptyResult();
      })
      .finally(() => {
        this.#inFlight = null;
        if (this.#rerunRequested) {
          this.#rerunRequested = false;
          void this.runTick(INLINE_TICK);
        }
      });
    return this.#inFlight;
  }

  /** Resolves when no tick is running, including a re-run a tick asked for. */
  async idle(): Promise<void> {
    while (this.#inFlight) await this.#inFlight;
  }

  /**
   * Start polling the queue (Node). Handlers must be registered first; with
   * none registered this logs an error and returns, which is only right for a
   * process that enqueues but never runs jobs.
   */
  async start(): Promise<void> {
    if (this.#timer) {
      logger.warn("Job workers already running");
      return;
    }
    if (this.#handlers.size === 0) {
      logger.error(
        "No job handlers registered — workers NOT started. Register handlers (startWebApp() does) before startWorkers().",
      );
      return;
    }

    const intervalMs = config.jobs.pollIntervalSeconds * 1000;
    this.#timer = setInterval(() => void this.runTick(), intervalMs);
    // Do not keep the process alive for the poller alone.
    if (typeof this.#timer === "object" && "unref" in this.#timer) this.#timer.unref();

    await this.runTick();
    logger.info({ workerCount: this.#handlers.size, intervalMs }, "Job workers started");
  }

  /** Stop polling and wait for the in-flight tick. */
  async stop(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    await this.idle();
  }

  /**
   * Fresh state, for tests: stop polling, forget every handler, the pending
   * re-run and the housekeeping schedule. A tick already running finishes;
   * `await idle()` first to wait for it.
   */
  reset(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#handlers.clear();
    this.#rerunRequested = false;
    nextHousekeepingCheck = 0;
  }

  /**
   * A transition landed `job` in `created`, due now. Tick inline when the
   * queue runs inline and a handler can take it: on Workers through the
   * request's `waitUntil` (covering any re-run), on Node as a detached tick.
   */
  #nudge(job: Job): void {
    if (!config.jobs.enabled || !config.jobs.runInline || !this.#handlers.has(job.name)) return;
    waitUntil(this.runTick(INLINE_TICK).then(() => this.idle()));
  }

  async #tick(options: TickOptions): Promise<TickResult> {
    const result = emptyResult();
    const now = new Date();

    if (options.schedules ?? true) result.scheduled = await this.#materializeSchedules(now);
    await this.#recoverStuckJobs(now);

    const claimed = await this.transitions.claim(
      this.handlerNames(),
      options.limit ?? config.jobs.batchSize,
      now,
    );
    result.claimed = claimed.length;
    for (const job of claimed) {
      const outcome = await this.#run(job);
      result[outcome] += 1;
    }

    if ((options.housekeeping ?? true) && (await claimHousekeeping(now))) {
      await housekeeping(now);
    }

    return result;
  }

  async #materializeSchedules(now: Date): Promise<number> {
    const schedules = await db.select().from(jobSchedules);
    let enqueued = 0;

    for (const schedule of schedules) {
      const next = nextCronRun(
        schedule.cron,
        schedule.lastRunAt ?? schedule.createdAt,
        schedule.timezone,
      );
      if (!next || next.getTime() > now.getTime()) continue;

      // Compare-and-set so two concurrent ticks never enqueue the same fire.
      const claimed = await db
        .update(jobSchedules)
        .set({ lastRunAt: now })
        .where(
          and(
            eq(jobSchedules.name, schedule.name),
            schedule.lastRunAt
              ? eq(jobSchedules.lastRunAt, schedule.lastRunAt)
              : sql`${jobSchedules.lastRunAt} IS NULL`,
          ),
        )
        .returning({ name: jobSchedules.name });
      if (claimed.length === 0) continue;

      await this.transitions.enqueue({ name: schedule.name, data: schedule.data, runAt: now });
      enqueued += 1;
    }

    return enqueued;
  }

  /**
   * Jobs stuck in `active` past the timeout (a crashed process) time out:
   * the same retry policy, log line and report as a handler failure.
   */
  async #recoverStuckJobs(now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - config.jobs.activeTimeoutSeconds * 1000);
    const stuck = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.state, "active"), lt(jobs.startedAt, cutoff)));
    // Each timeout is its own compare-and-set, so they can run together.
    await Promise.all(stuck.map((job) => this.transitions.apply(job, { type: "timeout" })));
  }

  async #run(job: Job): Promise<"completed" | "retried" | "failed"> {
    const handler = this.#handlers.get(job.name);
    if (!handler) {
      const next = await this.transitions.apply(job, {
        type: "fail",
        error: new Error("No handler registered"),
      });
      return next?.state === "created" ? "retried" : "failed";
    }

    const jobLogger = createJobLogger({ jobId: job.id, jobName: job.name });
    const startTime = Date.now();
    const attempt = job.retryCount + 1;
    jobLogger.info({ data: job.data, attempt }, `Starting job ${job.name}`);
    try {
      const output = await handler({
        id: job.id,
        name: job.name,
        data: job.data,
        attempt,
        logger: jobLogger,
      });
      const duration = Date.now() - startTime;
      jobLogger.info({ duration: `${duration}ms` }, `Job ${job.name} completed`);
      logPerformance({ operation: `job_${job.name}`, duration, data: { jobId: job.id } });
      await flushJobLogs();
      await this.transitions.apply(job, { type: "succeed", output });
      return "completed";
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance({
        operation: `job_${job.name}`,
        duration,
        data: { jobId: job.id, failed: true },
      });
      const next = await this.transitions.apply(job, { type: "fail", error, durationMs: duration });
      return next?.state === "created" ? "retried" : "failed";
    }
  }
}

/** The process-wide runner: `addJob()`, the poller and the Workers cron all use it. */
export const jobRunner = new JobRunner();

/** Run one tick on `jobRunner`. */
export function runTick(options: TickOptions = {}): Promise<TickResult> {
  return jobRunner.runTick(options);
}

/** Resolves when `jobRunner` has no tick running. */
export function tickInFlight(): Promise<void> {
  return jobRunner.idle();
}

/**
 * True when this tick owns the housekeeping slot. The last run time lives in a
 * kv row, claimed with one compare-and-set upsert, because a Workers isolate
 * starts with empty module state and an in-memory timer alone would let every
 * fresh isolate sweep again. The in-memory check spares the Node poller a
 * query on every tick.
 */
async function claimHousekeeping(now: Date): Promise<boolean> {
  const nowMs = now.getTime();
  if (nowMs < nextHousekeepingCheck) return false;

  const owned = await kv.claim(HOUSEKEEPING_KEY, HOUSEKEEPING_INTERVAL_MS);
  nextHousekeepingCheck = nowMs + (owned ? HOUSEKEEPING_INTERVAL_MS : HOUSEKEEPING_RECHECK_MS);
  return owned;
}

/** Next fire time of a cron expression after `from`, or null when it never fires. */
export function nextCronRun(cron: string, from: Date, timezone?: string | null): Date | null {
  return new Cron(cron, { timezone: timezone ?? undefined }).nextRun(from);
}

/**
 * Delete old finished jobs with their logs, and expired kv entries. Every
 * statement uses an index, so the cost follows what is deleted, not table size.
 */
export async function housekeeping(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - config.jobs.keepCompletedDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(jobs)
    .where(and(inArray(jobs.state, ["completed", "cancelled"]), lt(jobs.completedAt, cutoff)))
    .returning({ id: jobs.id });
  await deleteJobLogs(deleted.map((job) => job.id));
  await purgeExpiredKv();
}
