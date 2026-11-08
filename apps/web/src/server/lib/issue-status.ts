import type { FeedbackStatus } from "../db/schema";

/**
 * How a feedback status maps onto a GitHub issue. GitHub has only open/closed
 * plus a close reason, so `in_progress` is an open issue carrying this label.
 */
export const IN_PROGRESS_LABEL = "in progress";

export interface IssueSnapshot {
  state: "open" | "closed";
  /** REST `state_reason` or GraphQL `stateReason`, any case. */
  stateReason: string | null;
  labels: string[];
}

export function statusFromIssue(issue: IssueSnapshot): FeedbackStatus {
  if (issue.state === "closed") {
    const reason = issue.stateReason?.toLowerCase();
    return reason === "not_planned" || reason === "duplicate" ? "wont_fix" : "done";
  }
  return issue.labels.some((label) => label.toLowerCase() === IN_PROGRESS_LABEL)
    ? "in_progress"
    : "open";
}

/** The issue update that represents `status`. */
export function issueUpdate(status: FeedbackStatus): {
  state: "open" | "closed";
  stateReason?: "completed" | "not_planned";
  inProgressLabel: boolean;
} {
  switch (status) {
    case "open":
      return { state: "open", inProgressLabel: false };
    case "in_progress":
      return { state: "open", inProgressLabel: true };
    case "done":
      return { state: "closed", stateReason: "completed", inProgressLabel: false };
    case "wont_fix":
      return { state: "closed", stateReason: "not_planned", inProgressLabel: false };
  }
}
