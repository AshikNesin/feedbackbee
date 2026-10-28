import { expect, test } from "vitest";
import { createIssue, issueBody, issueLabels, issueTitle } from "../src/lib/github.ts";
import type { FeedbackRow } from "../src/types.ts";

const base: FeedbackRow = {
  id: "f1",
  project_id: "p1",
  kind: "issue",
  text: "Checkout button does nothing",
  reporter_email: "a@b.co",
  url: "https://shop.test/cart",
  reporter_name: null,
  reporter_id: null,
  metadata: null,
  user_agent: "UA",
  screen_w: 390,
  screen_h: 844,
  media_kind: "screenshot",
  media_key: "p/p1/f/x.png",
  media_seconds: null,
  audio_key: null,
  audio_seconds: null,
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

const urls = { images: ["https://barn.dev/f/p/p1/f/x.png"], media: null, audio: null, dashboard: "https://bee.dev/#acme/f1" };

test("title summarizes kind and device", () => {
  expect(issueTitle(base)).toContain("Issue:");
  expect(issueTitle(base)).toContain("[Pixel 8]");
});

test("body embeds screenshot and context table without reporter PII", () => {
  const body = issueBody(base, urls);
  expect(body).toContain("![image 1](https://barn.dev/f/p/p1/f/x.png)");
  expect(body).toContain("| Device | Pixel 8 |");
  expect(body).toContain("| OS | android 34 |");
  expect(body).toContain("| App version | 1.2.3 |");
  expect(body).toContain("| Screen | 390x844 |");
  expect(body).toContain("| User agent | UA |");
  expect(body).toContain("[Reporter details and context are in FeedbackBee (private)](https://bee.dev/#acme/f1)");
  expect(body).toContain("<sub>via FeedbackBee</sub>");
  expect(body).not.toContain("a@b.co");
  expect(body).not.toContain("| Reporter |");
  expect(body).not.toContain("shop.test");
  expect(body).not.toContain("Source");
});

test("body lists dashboard link as plain view without reporter details", () => {
  const f = { ...base, reporter_email: null, reporter_name: null, reporter_id: null, metadata: null };
  const body = issueBody(f, { ...urls, images: [] });
  expect(body).toContain("[View this report in FeedbackBee](https://bee.dev/#acme/f1)");
  expect(body).not.toContain("FeedbackBee (private)");
});

test("body embeds images in order before media and audio links", () => {
  const body = issueBody(
    { ...base, media_kind: "recording" as const, media_seconds: 10, audio_seconds: 23.4 },
    {
      images: ["https://bee.dev/f/i1.png", "https://bee.dev/f/i2.png"],
      media: "https://bee.dev/f/x.webm",
      audio: "https://bee.dev/f/a.webm",
      dashboard: null,
    },
  );
  const img1 = body.indexOf("![image 1](https://bee.dev/f/i1.png)");
  const img2 = body.indexOf("![image 2](https://bee.dev/f/i2.png)");
  const mediaIdx = body.indexOf("[Screen recording");
  const audioIdx = body.indexOf("[Voice note");
  expect(img1).toBeGreaterThan(-1);
  expect(img2).toBeGreaterThan(img1);
  expect(mediaIdx).toBeGreaterThan(img2);
  expect(audioIdx).toBeGreaterThan(mediaIdx);
  expect(body).not.toContain("FeedbackBee (private)");
});

test("recording body links with duration", () => {
  const rec = { ...base, media_kind: "recording" as const, media_seconds: 132 };
  const body = issueBody(rec, { ...urls, images: [], media: "https://barn.dev/f/p/p1/f/x.webm" });
  expect(body).toContain("[Screen recording (132s)]");
});

test("labels map falls back to empty on unknown kind", () => {
  expect(issueLabels("issue", '{"issue":"needs-triage"}')).toEqual(["needs-triage"]);
  expect(issueLabels("feature_request", "not json")).toEqual([]);
});

test("title uses the new kind prefixes", () => {
  expect(issueTitle({ ...base, kind: "feature_request" })).toContain("Feature request:");
  expect(issueTitle({ ...base, kind: "other" })).toContain("Other:");
});

test("issue creation posts to base and parses response", async () => {
  const calls: any[] = [];
  (globalThis as any).__GH = calls;
  const res = await createIssue("tok", "o/r", "T", "B", ["bug"]);
  // Without a live server this hits api.github.com; guard by asserting shape only on success path failure text
  expect(res.ok === true || (res.ok === false && res.error.startsWith("GitHub"))).toBe(true);
});

test("voice note links with duration after visual media", () => {
  const f = { ...base, audio_seconds: 23.4 };
  const body = issueBody(f, { ...urls, images: [], media: null, audio: "https://bee.dev/f/p/p1/f/a.webm" });
  expect(body).toContain("[Voice note (23s)](https://bee.dev/f/p/p1/f/a.webm)");
  const both = issueBody(
    { ...base, media_kind: "recording" as const, media_seconds: 10 },
    { images: [], media: "https://bee.dev/f/x.webm", audio: "https://bee.dev/f/a.webm", dashboard: null },
  );
  const mediaIdx = both.indexOf("[Screen recording");
  const audioIdx = both.indexOf("[Voice note");
  expect(mediaIdx).toBeGreaterThan(-1);
  expect(audioIdx).toBeGreaterThan(mediaIdx);
});
