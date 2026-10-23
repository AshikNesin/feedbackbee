import type { Env, FeedbackRow, LabelsMap, ProjectRow } from "../types.ts";
import { isReplayKey } from "./validate.ts";

declare global {
  // deno-lint-ignore no-var
  var __GITHUB_BASE: string | undefined;
}

function githubBase(): string {
  return globalThis.__GITHUB_BASE ?? "https://api.github.com";
}

export function issueTitle(f: Pick<FeedbackRow, "kind" | "text" | "device_model" | "os_name">): string {
  const label = f.kind === "bug" ? "Bug" : f.kind === "idea" ? "Idea" : "Feedback";
  const summary = f.text.replace(/\s+/g, " ").slice(0, 60) || "(no text)";
  const from = f.device_model ? ` [${f.device_model}]` : f.os_name ? ` [${f.os_name}]` : "";
  return `${label}: ${summary}${from}`.slice(0, 120);
}

function row(label: string, value: string | null | undefined): string {
  return `| ${label} | ${value && value !== "" ? value : "-" } |`;
}

export function issueBody(f: FeedbackRow, mediaUrl: string | null, audioUrl: string | null): string {
  const lines: string[] = [];
  lines.push(f.text, "");
  if (mediaUrl) {
    if (f.media_kind === "screenshot") {
      lines.push(`![screenshot](${mediaUrl})`, "");
    } else {
      const secs = f.media_seconds ? ` (${Math.round(f.media_seconds)}s)` : "";
      const label = isReplayKey(f.media_key) ? "\u25b6 Watch session replay" : "Screen recording";
      lines.push(`[${label}${secs}](${mediaUrl})`, "");
    }
  }
  if (audioUrl) {
    const secs = f.audio_seconds ? ` (${Math.round(f.audio_seconds)}s)` : "";
    lines.push(`[Voice note${secs}](${audioUrl})`, "");
  }
  lines.push("<details><summary>Context</summary>", "");
  lines.push("| | |", "|---|---|");
  lines.push(row("Source", f.url));
  lines.push(row("OS", f.os_name ? `${f.os_name} ${f.os_version ?? ""}`.trim() : null));
  lines.push(row("Device", f.device_model));
  lines.push(row("App version", f.app_version));
  lines.push(row("Screen", f.screen_w && f.screen_h ? `${f.screen_w}x${f.screen_h}` : null));
  lines.push(row("Reporter", f.reporter_email));
  lines.push(row("User agent", f.user_agent));
  lines.push("");
  lines.push("</details>");
  lines.push("", "<sub>via FeedbackBee</sub>");
  return lines.join("\n");
}

export function issueLabels(kind: FeedbackRow["kind"], mapJson: string): string[] {
  let map: LabelsMap = {};
  try {
    map = JSON.parse(mapJson) as LabelsMap;
  } catch {
    // keep defaults below
  }
  const label = map[kind];
  return label ? [label] : [];
}

export type IssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; error: string };

export async function createIssue(
  secret: string,
  repo: string,
  title: string,
  body: string,
  labels: string[],
  retry = true,
): Promise<IssueResult> {
  const res = await fetch(`${githubBase()}/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "feedbackbee",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (res.ok) {
    const data = (await res.json()) as { number: number; html_url: string };
    return { ok: true, number: data.number, url: data.html_url };
  }
  const errorText = await res.text();
  if (retry && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 300));
    return createIssue(secret, repo, title, body, labels, false);
  }
  return { ok: false, error: `GitHub ${res.status}: ${errorText.slice(0, 500)}` };
}

export async function createIssueForProject(
  env: Pick<Env, "GITHUB_TOKEN">,
  project: ProjectRow,
  title: string,
  body: string,
  labels: string[],
): Promise<IssueResult> {
  return createIssue(env.GITHUB_TOKEN, project.github_repo, title, body, labels);
}
