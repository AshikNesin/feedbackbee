import { eq } from "drizzle-orm";
import { Cron } from "croner";
import { db } from "@groot/core/database";
import { Boom } from "@groot/core/errors";
import { logger } from "@groot/core/logger";
import { jobSchedules, type JobSchedule } from "./schema";
import { jobRunner } from "./tick";
import { assertJobName } from "./transitions";
import type { BulkRerunResult, ScheduleJobOptions, SendJobOptions } from "./types";

/**
 * The queue API. Every job write is a transition (`transitions.ts`) on
 * `jobRunner`, so these functions share its retry policy, its not-found and
 * wrong-state errors, and its inline-tick nudge.
 */

/** Queue a job. Returns its id (the existing one for a pending `singletonKey`). */
export async function addJob<T = unknown>(
  name: string,
  data: T,
  options: SendJobOptions = {},
): Promise<string> {
  return (await jobRunner.transitions.enqueue({ ...options, name, data })).id;
}

function assertCron(cron: string, timezone?: string): void {
  try {
    new Cron(cron, { timezone });
  } catch (error) {
    throw Boom.badRequest(
      `Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`,
      null,
      "JOB_SCHEDULE_VALIDATION_ERROR",
    );
  }
}

/**
 * Create or replace the recurring schedule for `name`. Replacing keeps
 * `lastRunAt`, so editing a schedule does not re-fire a run it already made.
 */
export async function scheduleJob(
  name: string,
  data: unknown,
  cron: string,
  options: ScheduleJobOptions = {},
): Promise<JobSchedule> {
  assertJobName(name);
  assertCron(cron, options.timezone);
  const values = { name, cron, data: data ?? null, timezone: options.timezone ?? null };
  const [schedule] = await db
    .insert(jobSchedules)
    .values(values)
    .onConflictDoUpdate({ target: jobSchedules.name, set: { ...values, updatedAt: new Date() } })
    .returning();
  logger.info({ name, cron }, "Job scheduled");
  return schedule!;
}

export async function cancelScheduledJob(name: string): Promise<void> {
  const deleted = await db.delete(jobSchedules).where(eq(jobSchedules.name, name)).returning();
  if (deleted.length === 0) throw Boom.notFound(`Schedule not found: ${name}`);
  logger.info({ name }, "Job schedule removed");
}

export async function deleteJob(jobId: string): Promise<void> {
  await jobRunner.transitions.apply(jobId, { type: "delete" });
}

/** Put a failed or cancelled job back on the queue. */
export async function retryJob(jobId: string): Promise<void> {
  await jobRunner.transitions.apply(jobId, { type: "retry" });
}

export async function cancelJob(jobId: string): Promise<void> {
  await jobRunner.transitions.apply(jobId, { type: "cancel" });
}

export async function resumeJob(jobId: string): Promise<void> {
  await jobRunner.transitions.apply(jobId, { type: "resume" });
}

/** Queue a fresh copy of a finished job. Returns the new job's id. */
export async function rerunJob(jobId: string): Promise<string> {
  return (await jobRunner.transitions.apply(jobId, { type: "rerun" })).id;
}

export async function rerunJobs(jobIds: string[]): Promise<BulkRerunResult[]> {
  const results = await Promise.allSettled(jobIds.map((jobId) => rerunJob(jobId)));
  return results.map((result, index) => {
    const jobId = jobIds[index]!;
    return result.status === "fulfilled"
      ? { jobId, success: true, newJobId: result.value }
      : {
          jobId,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
  });
}
