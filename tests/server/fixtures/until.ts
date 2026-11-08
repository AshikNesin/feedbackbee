import { afterEach, beforeEach, vi } from "vite-plus/test";

const FAIL_BEFORE_TEST_TIMEOUT_MS = 200;

let testTimeoutAt = Number.POSITIVE_INFINITY;

export function boundWaitsByTestTimeout(): void {
  beforeEach(({ task }) => {
    testTimeoutAt =
      task.timeout > 0
        ? vi.getRealSystemTime() + task.timeout - FAIL_BEFORE_TEST_TIMEOUT_MS
        : Number.POSITIVE_INFINITY;
  });
  afterEach(() => {
    testTimeoutAt = Number.POSITIVE_INFINITY;
  });
}

// Not Date.now(): tests freeze Date (tests/test-clock.ts). Not
// performance.now(): vi.useFakeTimers() fakes it too.
function realTimeDeadline(ms: number): () => boolean {
  const at = Math.min(vi.getRealSystemTime() + ms, testTimeoutAt);
  return () => vi.getRealSystemTime() >= at;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until<T>(
  check: () => T | false | undefined | null | Promise<T | false | undefined | null>,
  what: string,
  ms = 10_000,
): Promise<T> {
  const expired = realTimeDeadline(ms);
  for (;;) {
    const value = await check();
    if (value) return value;
    if (expired()) throw new Error(`Timed out waiting for ${what}`);
    await pause(15);
  }
}

export async function eventually(check: () => void | Promise<void>, ms = 3_000): Promise<void> {
  const expired = realTimeDeadline(ms);
  for (;;) {
    try {
      await check();
      return;
    } catch (error) {
      if (expired()) throw error;
    }
    await pause(15);
  }
}
