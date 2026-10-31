import { ApiError } from "@groot/shell/lib/api";

/**
 * What to show for a failed request. A validation failure's message is the
 * generic "Validation failed"; the field's own message (in `details`, keyed by
 * field) says what to fix, so that wins.
 */
export function errorMessage(error: Error): string {
  if (error instanceof ApiError && error.details && typeof error.details === "object") {
    for (const messages of Object.values(error.details as Record<string, unknown>)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
    }
  }
  return error.message;
}
