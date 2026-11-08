import { toast } from "sonner";
import type { ReactNode } from "react";
import { describeError } from "@groot/shell/lib/feedback";

/**
 * Shorten a job ID for display. Long IDs (UUIDs) are truncated to the first 6
 * chars; short IDs are shown in full.
 */
export function formatJobId(id: string): string {
  return id.length > 8 ? id.substring(0, 6) : id;
}

/**
 * Parse a job payload typed into `JobDataEditor`. Throws an `Error` whose
 * message is meant for the person (the shell's `describeError` shows it), not
 * the raw `SyntaxError`.
 */
export function parseJobData(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Job data is not valid JSON.");
  }
}

/**
 * @deprecated Use `useAction` from `@groot/shell/lib/feedback`, which also
 * owns pending state, double-submit, confirmation and invalidation. Kept for
 * existing callers; its error toast is now worded by `describeError`.
 *
 * Run a job action with the standard toast pattern: success toast (with the
 * given description) and error toast (the server's message or the fallback).
 */
export async function withJobToast<T>(
  action: () => Promise<T>,
  successDescription: (result: T) => ReactNode,
  fallbackError: string,
  onSuccess?: () => void,
): Promise<void> {
  try {
    const result = await action();
    toast.success("Success", { description: successDescription(result) });
    onSuccess?.();
  } catch (error) {
    console.error(error);
    toast.error("Error", { description: describeError(error, fallbackError) });
  }
}
