import type { JobHandler } from "./types";
import { jobRunner } from "./tick";

/**
 * Handler registry and Node polling driver, as functions over `jobRunner`
 * (`tick.ts`), which owns the state. Workers do not call `startWorkers()`;
 * their cron trigger calls `runTick()` directly.
 */

export function registerJobHandler<T, R = unknown>(name: string, handler: JobHandler<T, R>): void {
  jobRunner.register(name, handler);
}

export function getRegisteredHandlers(): string[] {
  return jobRunner.handlerNames();
}

export function getJobHandler(name: string): JobHandler | undefined {
  return jobRunner.handler(name);
}

/**
 * Test helper.
 * @deprecated Use `jobRunner.reset()`, which also clears the rest of the
 * runner state (poll timer, pending re-run, housekeeping schedule).
 */
export function clearJobHandlers(): void {
  jobRunner.reset();
}

/**
 * Start polling the queue (Node). Handlers must be registered first; with none
 * registered this logs an error and returns, which is only right for a process
 * that enqueues but never runs jobs.
 */
export function startWorkers(): Promise<void> {
  return jobRunner.start();
}

/** Stop polling and wait for the in-flight tick. */
export function stopWorkers(): Promise<void> {
  return jobRunner.stop();
}
