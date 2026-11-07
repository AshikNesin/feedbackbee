import { createGithubIssue } from "../api/github/github.client";
import { safeGithubError } from "../api/github/github.service";
import type { Feedback, FeedbackKind, LabelsMap } from "../db/schema";
import { isReplayKey } from "./media";

/**
 * GitHub issues for feedback, authenticated with the deployment's GitHub App.
 */

const KIND_TITLES: Record<FeedbackKind, string> = {
  issue: "Issue",
  feature_request: "Feature request",
  other: "Other",
};

export function issueTitle(f: Pick<Feedback, "kind" | "text" | "deviceModel" | "osName">): string {
  const summary = f.text.replace(/\s+/g, " ").slice(0, 60) || "(no text)";
  const from = f.deviceModel ? ` [${f.deviceModel}]` : f.osName ? ` [${f.osName}]` : "";
  return `${KIND_TITLES[f.kind]}: ${summary}${from}`.slice(0, 120);
}

function row(label: string, value: string | null | undefined): string {
  return `| ${label} | ${value ? value : "-"} |`;
}

export interface IssueLinks {
  images: string[];
  recording: string | null;
  audio: string | null;
  dashboard: string;
}

/**
 * The issue body. GitHub issues are public: reporter email, name, id, page URL
 * and metadata stay in FeedbackBee and are never written here (docs/CONTRACT.md).
 */
export function issueBody(f: Feedback, links: IssueLinks): string {
  const lines: string[] = [f.text, ""];
  links.images.forEach((url, i) => lines.push(`![image ${i + 1}](${url})`, ""));
  if (links.recording) {
    const secs = f.recordingSeconds ? ` (${Math.round(f.recordingSeconds)}s)` : "";
    const label = isReplayKey(f.recordingKey) ? "▶ Watch session replay" : "Screen recording";
    lines.push(`[${label}${secs}](${links.recording})`, "");
  }
  if (links.audio) {
    const secs = f.audioSeconds ? ` (${Math.round(f.audioSeconds)}s)` : "";
    lines.push(`[Voice note${secs}](${links.audio})`, "");
  }
  lines.push("<details><summary>Context</summary>", "", "| | |", "|---|---|");
  lines.push(row("OS", f.osName ? `${f.osName} ${f.osVersion ?? ""}`.trim() : null));
  lines.push(row("Device", f.deviceModel));
  lines.push(row("App version", f.appVersion));
  lines.push(row("Screen", f.screenW && f.screenH ? `${f.screenW}x${f.screenH}` : null));
  lines.push(row("User agent", f.userAgent));
  lines.push("", "</details>");
  const private_ = Boolean(f.reporterEmail || f.reporterName || f.reporterId || f.metadata);
  const linkText = private_
    ? "Reporter details and context are in FeedbackBee (private)"
    : "View this report in FeedbackBee";
  lines.push("", `[${linkText}](${links.dashboard})`, "", "<sub>via FeedbackBee</sub>");
  return lines.join("\n");
}

export function issueLabels(kind: FeedbackKind, labels: LabelsMap): string[] {
  const label = labels[kind];
  return label ? [label] : [];
}

export type IssueResult = { ok: true; number: number; url: string } | { ok: false; error: string };

/** GitHub failures must not discard a report already saved in D1. */
export async function createIssue(
  repo: string,
  issue: { title: string; body: string; labels: string[] },
): Promise<IssueResult> {
  try {
    return { ok: true, ...(await createGithubIssue(repo, issue)) };
  } catch (error) {
    return { ok: false, error: safeGithubError(error) };
  }
}
