import { SELF, env } from "cloudflare:test";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { ghCalls, network, stubGithub } from "./gh-server";
import {
  ORIGIN,
  api,
  createProject,
  latestFeedback,
  login,
  png,
  replay,
  submit,
  webm,
} from "./helpers";

// POST /api/v1/feedback: the public submit endpoint (docs/CONTRACT.md).

const okGithub = () =>
  stubGithub(() => ({
    status: 201,
    json: { number: 42, html_url: "https://github.com/ashik/myapp/issues/42" },
  }));

beforeAll(() => {
  network.enable();
  okGithub();
});
afterEach(() => {
  network.resetHandlers();
  okGithub();
});
afterAll(() => network.disable());

async function project(prefix: string) {
  const cookie = await login();
  return { cookie, ...(await createProject(cookie, prefix)) };
}

test("a report files a labelled issue and answers 201 in the envelope", async () => {
  const p = await project("basic");
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "Cart total shows NaN",
    image: png(),
  });

  expect(res.status).toBe(201);
  expect(res.body).toEqual({
    success: true,
    data: {
      id: expect.any(String),
      state: "created",
      issueUrl: "https://github.com/ashik/myapp/issues/42",
    },
  });
  const gh = ghCalls.at(-1)!;
  expect(gh.path).toBe("/repos/ashik/myapp/issues");
  expect(gh.auth).toBe(`Bearer ${env.GITHUB_TOKEN}`);
  expect(gh.body.labels).toEqual(["bug"]);
  expect(gh.body.title).toMatch(/^Issue: Cart total shows NaN/);
  expect(gh.body.body).toContain("![image 1](https://example.com/f/p/");

  const row = await latestFeedback(p.cookie, p.id);
  expect(row).toMatchObject({
    kind: "issue",
    state: "created",
    issueNumber: 42,
    recordingKey: null,
  });
  expect(row.images).toHaveLength(1);
  const media = await SELF.fetch(`${ORIGIN}/f/${row.images[0]}`);
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
  expect(media.headers.get("cache-control")).toContain("immutable");
});

test("any website may post: CORS * without credentials, even with a dashboard allow-list", async () => {
  const preflight = await SELF.fetch(`${ORIGIN}/api/v1/feedback`, {
    method: "OPTIONS",
    headers: { Origin: "https://customer.example", "Access-Control-Request-Method": "POST" },
  });
  expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
  expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();
});

test("a GitHub failure keeps the report and answers 202 with the reason", async () => {
  const p = await project("ghfail");
  stubGithub(() => ({ status: 404, json: { message: "Not Found" } }));
  const res = await submit({ project: p.slug, kind: "other", text: "repo was renamed" });

  expect(res.status).toBe(202);
  expect(res.body.data).toMatchObject({
    state: "issue_error",
    error: expect.stringContaining("GitHub 404"),
  });
  const row = await latestFeedback(p.cookie, p.id);
  expect(row).toMatchObject({
    state: "issue_error",
    issueError: expect.stringContaining("GitHub 404"),
  });
});

test("the issue never carries reporter email, name, id, metadata or page url", async () => {
  const p = await project("pii");
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "Cannot change my plan",
    email: "jane@shop.test",
    url: "https://shop.test/settings/billing",
    reporter_name: "Ada Lovelace",
    reporter_id: "user_42",
    metadata: JSON.stringify({ plan: "platinum-tier", build: 4211, beta: true }),
  });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)!.body.body as string;
  for (const secret of [
    "jane@shop.test",
    "shop.test/settings",
    "Ada Lovelace",
    "user_42",
    "platinum-tier",
  ]) {
    expect(body).not.toContain(secret);
  }
  expect(body).toContain(
    `[Reporter details and context are in FeedbackBee (private)](${ORIGIN}/projects/${p.slug}?feedback=${res.body.data.id})`,
  );

  const row = await latestFeedback(p.cookie, p.id);
  expect(row).toMatchObject({
    reporterEmail: "jane@shop.test",
    reporterName: "Ada Lovelace",
    reporterId: "user_42",
    url: "https://shop.test/settings/billing",
    metadata: { plan: "platinum-tier", build: 4211, beta: true },
  });
});

test("a web page recording is stored as a replay and linked from the issue", async () => {
  const p = await project("replay");
  const doc = {
    v: 1,
    url: "https://shop.test/cart",
    viewport: { w: 1280, h: 800 },
    events: [
      { type: 4, timestamp: 1 },
      { type: 2, timestamp: 2 },
    ],
  };
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "Discount button breaks the total",
    media: await replay(doc),
    media_seconds: "12",
  });
  expect(res.status).toBe(201);

  const issue = ghCalls.at(-1)!.body.body as string;
  const link = issue.match(
    /\[▶ Watch session replay \(12s\)\]\((https:\/\/example\.com\/replay\/(p\/[^)]+\.rrweb\.gz))\)/,
  );
  expect(link).not.toBeNull();

  const page = await SELF.fetch(link![1]!);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
  expect(await page.text()).toContain('<script src="/replay-player.js">');

  const media = await SELF.fetch(`${ORIGIN}/f/${link![2]}`);
  expect(media.headers.get("content-type")).toBe("application/gzip");
  const back = await new Response(media.body!.pipeThrough(new DecompressionStream("gzip"))).json();
  expect(back).toEqual(doc);

  expect((await SELF.fetch(`${ORIGIN}/replay/p/x/f/y.png`)).status).toBe(404);
  expect((await latestFeedback(p.cookie, p.id)).recordingSeconds).toBe(12);
});

test("images ride along with a recording, in order, before it", async () => {
  const p = await project("recimg");
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "replay with two screenshots",
    media: await replay(),
    media_seconds: "8",
    image: [png(1), png(2)],
  });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)!.body.body as string;
  const positions = ["![image 1](", "![image 2](", "[▶ Watch session replay (8s)]"].map((s) =>
    body.indexOf(s),
  );
  expect(positions.every((i) => i > -1)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);

  const row = await latestFeedback(p.cookie, p.id);
  expect(row.recordingKey).toMatch(/\.rrweb\.gz$/);
  expect(row.images).toHaveLength(2);
});

test("five images are stored and embedded in the order they were attached", async () => {
  const p = await project("img5");
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "five shots",
    image: [1, 2, 3, 4, 5].map(png),
  });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)!.body.body as string;
  const keys = (await latestFeedback(p.cookie, p.id)).images as string[];
  expect(keys).toHaveLength(5);
  const order = keys.map((k) => body.indexOf(`${ORIGIN}/f/${k}`));
  expect(order.every((i) => i > -1)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(body).not.toContain("![image 6](");
});

test("a voice note is stored and linked with its duration", async () => {
  const p = await project("voice");
  const res = await submit({
    project: p.slug,
    kind: "feature_request",
    text: "Please add dark mode",
    audio: webm(),
    audio_seconds: "31",
  });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)!.body.body as string;
  const link = body.match(/\[Voice note \(31s\)\]\(([^)]+)\)/)?.[1];
  expect(link).toBeDefined();
  const audio = await SELF.fetch(link!);
  expect(audio.status).toBe(200);
  expect(audio.headers.get("content-type")).toBe("audio/webm");
});

test.each([
  ["no project", { project: "", kind: "issue", text: "hi" }, 400, "project is required"],
  ["empty text", { kind: "issue", text: "  " }, 400, "text is required"],
  ["unknown kind", { kind: "complaint", text: "hi" }, 400, "kind must be one of"],
  ["legacy kind", { kind: "bug", text: "hi" }, 400, "kind must be one of"],
  ["text over 5000", { kind: "issue", text: "x".repeat(5001) }, 400, "at most 5000"],
  ["audio without seconds", { kind: "other", text: "hi", audio: webm() }, 400, "audio_seconds"],
  [
    "recording over 300s",
    { kind: "other", text: "hi", media: "REPLAY", media_seconds: "301" },
    400,
    "media_seconds",
  ],
  [
    "six images",
    { kind: "issue", text: "hi", image: [1, 2, 3, 4, 5, 6].map(png) },
    400,
    "at most 5 images",
  ],
  [
    "two recordings",
    { kind: "issue", text: "hi", media: ["REPLAY", "REPLAY"], media_seconds: "3" },
    400,
    "one recording",
  ],
  [
    "png as recording",
    { kind: "issue", text: "hi", media: png(), media_seconds: "3" },
    415,
    "not a supported format",
  ],
  [
    "video as image",
    { kind: "issue", text: "hi", image: webm("clip.webm") },
    415,
    "not a supported format",
  ],
])("rejects %s", async (_label, fields, status, message) => {
  const p = await project("bad");
  // "REPLAY" stands for a valid recording file; the project defaults to a real one.
  const one = async (v: unknown) => (v === "REPLAY" ? await replay() : (v as string | File));
  const resolved: Record<string, string | File | Array<string | File>> = { project: p.slug };
  for (const [name, value] of Object.entries(fields)) {
    resolved[name] = Array.isArray(value) ? await Promise.all(value.map(one)) : await one(value);
  }

  const before = ghCalls.length;
  const res = await submit(resolved);
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
  expect(res.body.error.message).toContain(message);
  expect(ghCalls.length).toBe(before);
});

test.each([
  ["oversize", JSON.stringify({ big: "x".repeat(4100) })],
  [
    "too many keys",
    JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))),
  ],
  ["bad key", JSON.stringify({ "bad key!": "v" })],
  ["nested object", JSON.stringify({ outer: { inner: "v" } })],
  ["array", JSON.stringify([1, 2, 3])],
  ["not json", "{oops"],
])("rejects metadata: %s", async (_label, metadata) => {
  const p = await project("metabad");
  const res = await submit({ project: p.slug, kind: "issue", text: "bad metadata", metadata });
  expect(res.status).toBe(400);
  expect(res.body.error.message).toMatch(/^metadata /);
});

test("empty metadata counts as none; over-long reporter fields are dropped, not rejected", async () => {
  const p = await project("caps");
  const res = await submit({
    project: p.slug,
    kind: "issue",
    text: "long identity fields",
    metadata: "",
    reporter_name: "x".repeat(121),
    reporter_id: "y".repeat(129),
  });
  expect(res.status).toBe(201);
  const row = await latestFeedback(p.cookie, p.id);
  expect(row).toMatchObject({ metadata: null, reporterName: null, reporterId: null });
});

test("oversized images are rejected with 413 before anything is stored", async () => {
  const p = await project("big");
  const one = await submit({
    project: p.slug,
    kind: "issue",
    text: "one huge image",
    image: new File([new Uint8Array(11 * 1024 * 1024)], "huge.png", { type: "image/png" }),
  });
  expect(one.status).toBe(413);

  // 4 x 13 MB: over the 50 MB combined cap, checked before the per-image cap.
  const mb13 = new Uint8Array(13 * 1024 * 1024);
  mb13.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const four = await submit({
    project: p.slug,
    kind: "issue",
    text: "four chunky images",
    image: [0, 1, 2, 3].map((i) => new File([mb13], `big-${i}.png`, { type: "image/png" })),
  });
  expect(four.status).toBe(413);
  expect(four.body.error.message).toContain("combined");

  const { body } = await api(p.cookie, `/projects/${p.id}/feedback`);
  expect(body.data.items).toHaveLength(0);
});

test("an unknown project is a 404", async () => {
  const res = await submit({ project: "ghost", kind: "issue", text: "hello" });
  expect(res.status).toBe(404);
  expect(res.body.error.message).toBe("unknown project");
});

test("the 21st report within an hour is rate limited with Retry-After", async () => {
  const p = await project("rl");
  let last: Awaited<ReturnType<typeof submit>> | undefined;
  for (let i = 0; i < 21; i++) {
    last = await submit({
      project: p.slug,
      kind: "feature_request",
      text: `dark mode please ${i}`,
    });
  }
  expect(last!.status).toBe(429);
  expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
});

test("the demo page provisions the demo project on a fresh install", async () => {
  const demo = await SELF.fetch(`${ORIGIN}/demo`);
  expect(demo.status).toBe(200);
  expect(await demo.text()).toContain('<script src="/embed.js" data-project="demo"');

  const res = await submit({
    project: "demo",
    kind: "other",
    text: "broken checkout from the demo",
  });
  expect(res.status).toBe(201);
  expect((await SELF.fetch(`${ORIGIN}/demo`)).status).toBe(200);
});
