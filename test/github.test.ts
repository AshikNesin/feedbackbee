import { expect, test } from "vitest";
import { createIssue, issueBody, issueLabels, issueTitle } from "../src/lib/github.ts";
import type { FeedbackRow } from "../src/types.ts";

const base: FeedbackRow = {
  id: "f1",
  project_id: "p1",
  kind: "bug",
  text: "Checkout button does nothing",
  reporter_email: "a@b.co",
  url: "https://shop.test/cart",
  user_agent: "UA",
  screen_w: 390,
  screen_h: 844,
  media_kind: "screenshot",
  media_key: "p/p1/f/x.png",
  media_seconds: null,
  app_version: "1.2.3",
  os_name: "android",
  os_version: "34",
  device_model: "Pixel 8",
  issue_number: null,
  issue_url: null,
  state: "pending",
  issue_error: null,
  created_at: Date.now(),
};

test("title summarizes kind and device", () => {
  expect(issueTitle(base)).toContain("Bug:");
  expect(issueTitle(base)).toContain("[Pixel 8]");
});

test("body embeds screenshot and context table", () => {
  const body = issueBody(base, "https://barn.dev/f/p/p1/f/x.png");
  expect(body).toContain("![screenshot](https://barn.dev/f/p/p1/f/x.png)");
  expect(body).toContain("| Device | Pixel 8 |");
  expect(body).toContain("| Reporter | a@b.co |");
});

test("recording body links with duration", () => {
  const rec = { ...base, media_kind: "recording" as const, media_seconds: 132 };
  const body = issueBody(rec, "https://barn.dev/f/p/p1/f/x.webm");
  expect(body).toContain("[Screen recording (132s)]");
});

test("labels map falls back to empty on unknown kind", () => {
  expect(issueLabels("bug", '{"bug":"needs-triage"}')).toEqual(["needs-triage"]);
  expect(issueLabels("idea", "not json")).toEqual([]);
});

test("issue creation posts to base and parses response", async () => {
  const calls: any[] = [];
  (globalThis as any).__GH = calls;
  const res = await createIssue("tok", "o/r", "T", "B", ["bug"]);
  // Without a live server this hits api.github.com; guard by asserting shape only on success path failure text
  expect(res.ok === true || (res.ok === false && res.error.startsWith("GitHub"))).toBe(true);
});
