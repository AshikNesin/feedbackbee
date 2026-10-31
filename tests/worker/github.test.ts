import { expect, test } from "vitest";
import { issueBody, issueLabels, issueTitle } from "../../apps/web/src/server/lib/github";
import type { Feedback } from "../../apps/web/src/server/db/schema";

const base: Feedback = {
  id: "f1",
  projectId: "p1",
  kind: "issue",
  text: "Checkout button does nothing",
  reporterEmail: "a@b.co",
  reporterName: null,
  reporterId: null,
  metadata: null,
  url: "https://shop.test/cart",
  userAgent: "UA",
  screenW: 390,
  screenH: 844,
  appVersion: "1.2.3",
  osName: "android",
  osVersion: "34",
  deviceModel: "Pixel 8",
  recordingKey: null,
  recordingSeconds: null,
  audioKey: null,
  audioSeconds: null,
  state: "pending",
  issueNumber: null,
  issueUrl: null,
  issueError: null,
  createdAt: new Date(),
};

const links = {
  images: ["https://barn.dev/f/p/p1/f/x.png"],
  recording: null,
  audio: null,
  dashboard: "https://bee.dev/projects/acme?feedback=f1",
};

test("title summarizes kind and device", () => {
  expect(issueTitle(base)).toBe("Issue: Checkout button does nothing [Pixel 8]");
  expect(issueTitle({ ...base, kind: "feature_request" })).toMatch(/^Feature request:/);
  expect(issueTitle({ ...base, kind: "other", deviceModel: null })).toBe(
    "Other: Checkout button does nothing [android]",
  );
});

test("body embeds images and the context table, never reporter PII", () => {
  const body = issueBody(base, links);
  expect(body).toContain("![image 1](https://barn.dev/f/p/p1/f/x.png)");
  expect(body).toContain("| Device | Pixel 8 |");
  expect(body).toContain("| OS | android 34 |");
  expect(body).toContain("| App version | 1.2.3 |");
  expect(body).toContain("| Screen | 390x844 |");
  expect(body).toContain("| User agent | UA |");
  expect(body).toContain(
    "[Reporter details and context are in FeedbackBee (private)](https://bee.dev/projects/acme?feedback=f1)",
  );
  expect(body).toContain("<sub>via FeedbackBee</sub>");
  expect(body).not.toContain("a@b.co");
  expect(body).not.toContain("shop.test");
});

test("dashboard link reads as a plain view when there are no reporter details", () => {
  const f = { ...base, reporterEmail: null };
  expect(issueBody(f, { ...links, images: [] })).toContain(
    "[View this report in FeedbackBee](https://bee.dev/projects/acme?feedback=f1)",
  );
});

test("images come first, then the recording, then the voice note", () => {
  const body = issueBody(
    { ...base, recordingKey: "p/p1/f/x.webm", recordingSeconds: 10, audioSeconds: 23.4 },
    {
      images: ["https://bee.dev/f/i1.png", "https://bee.dev/f/i2.png"],
      recording: "https://bee.dev/f/x.webm",
      audio: "https://bee.dev/f/a.webm",
      dashboard: "https://bee.dev/projects/acme?feedback=f1",
    },
  );
  const order = [
    "![image 1](https://bee.dev/f/i1.png)",
    "![image 2](https://bee.dev/f/i2.png)",
    "[Screen recording (10s)](https://bee.dev/f/x.webm)",
    "[Voice note (23s)](https://bee.dev/f/a.webm)",
  ].map((needle) => body.indexOf(needle));
  expect(order.every((i) => i > -1)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test("a replay recording links to the replay viewer", () => {
  const body = issueBody(
    { ...base, recordingKey: "p/p1/f/x.rrweb.gz", recordingSeconds: 12 },
    { ...links, images: [], recording: "https://bee.dev/replay/p/p1/f/x.rrweb.gz" },
  );
  expect(body).toContain(
    "[▶ Watch session replay (12s)](https://bee.dev/replay/p/p1/f/x.rrweb.gz)",
  );
});

test("labels come from the project's map; a kind without a label files unlabelled", () => {
  expect(issueLabels("issue", { issue: "needs-triage" })).toEqual(["needs-triage"]);
  expect(issueLabels("feature_request", { issue: "bug" })).toEqual([]);
});
