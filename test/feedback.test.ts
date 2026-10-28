import { SELF, env } from "cloudflare:test";
import { expect, test, beforeAll, afterEach, afterAll } from "vitest";
import { ghCalls, network, stubGithub } from "./gh-server.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pngFile = () => new File([PNG], "shot.png", { type: "image/png" });

const okGithub = () => stubGithub(() => ({ status: 201, json: { number: 42, html_url: "https://github.com/ashik/myapp/issues/42" } }));

beforeAll(() => {
  network.enable();
  okGithub();
});
afterEach(() => {
  network.resetHandlers();
  okGithub();
});
afterAll(() => network.disable());

async function login(): Promise<string> {
  const res = await SELF.fetch("https://example.com/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@test.dev", password: "hunter2boogaloo" }),
  });
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function feedbackPage(cookie: string, slug: string) {
  const projects: any = await (await SELF.fetch("https://example.com/api/projects", { headers: { cookie } })).json();
  const proj = projects.projects.find((p: any) => p.slug === slug);
  const detail = await SELF.fetch(`https://example.com/api/projects/${proj.id}/feedback`, { headers: { cookie } });
  return (await detail.json()) as any;
}

async function createProject(cookie: string, slug: string) {
  return SELF.fetch("https://example.com/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name: "My App",
      slug,
      github_repo: "ashik/myapp",
    }),
  });
}

test("health is public", async () => {
  const res = await SELF.fetch("https://example.com/api/health");
  expect(res.status).toBe(200);
});

test("login seeds first admin and sets session", async () => {
  const cookie = await login();
  expect(cookie).toContain("fb_session=");
});

test("project create requires auth", async () => {
  const res = await SELF.fetch("https://example.com/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", slug: "x", github_repo: "a/b" }),
  });
  expect(res.status).toBe(401);
});

test("project CRUD happy path, pat never returned", async () => {
  const cookie = await login();
  const create = await createProject(cookie, `crud-${Date.now()}`);
  expect(create.status).toBe(201);
  const body: any = await create.json();
  expect(body.project.github_repo).toBe("ashik/myapp");
  expect(JSON.stringify(body)).not.toContain("ghp_");

  const list = await SELF.fetch("https://example.com/api/projects", { headers: { cookie } });
  const listed: any = await list.json();
  expect(listed.projects.length).toBeGreaterThan(0);
  expect(JSON.stringify(listed)).not.toContain("ghp_");
});

test("legacy screenshot is stored as image 0 and legacy kind bug maps to issue", async () => {
  const cookie = await login();
  const slug = `shot-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "bug");
  form.append("text", "Cart total shows NaN");
  form.append("url", "https://shop.test/cart");
  form.append("os_name", "web");
  form.append("media", pngFile());
  form.append("media_kind", "screenshot");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);
  const data: any = await res.json();
  expect(data.state).toBe("created");
  expect(data.issueUrl).toBe("https://github.com/ashik/myapp/issues/42");

  const gh = ghCalls.at(-1);
  expect(gh?.path).toBe("/repos/ashik/myapp/issues");
  expect(gh?.auth).toBe(`Bearer ${env.GITHUB_TOKEN}`);
  // legacy "bug" is stored as "issue"; the migrated labels_map still yields the "bug" label
  expect(gh?.body.labels).toEqual(["bug"]);
  expect(gh?.body.title).toMatch(/^Issue:/);
  expect(gh?.body.body).toContain("![image 1](");

  const page = await feedbackPage(cookie, slug);
  const row = page.feedback[0];
  expect(row.kind).toBe("issue");
  expect(row.media_kind).toBe("none");
  expect(row.media_key).toBeNull();
  expect(row.images.length).toBe(1);
  const key = row.images[0];
  expect(key).toMatch(/^p\/.+\.png$/);
  const media = await SELF.fetch(`https://example.com/f/${key}`);
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
});

test("github issue body never contains reporter email or page url", async () => {
  const cookie = await login();
  const slug = `pii-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "Cannot change my plan");
  form.append("email", "jane@shop.test");
  form.append("url", "https://shop.test/settings/billing");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const gh = ghCalls.at(-1);
  expect(gh?.body.body).not.toContain("jane@shop.test");
  expect(gh?.body.body).not.toContain("shop.test/settings");
  expect(gh?.body.body).not.toContain("| Reporter |");
  expect(gh?.body.body).not.toContain("| Source |");
  expect(gh?.body.body).toContain("Reporter details and context are in FeedbackBee (private)");
  expect(gh?.body.body).toMatch(/\[Reporter details and context are in FeedbackBee \(private\)\]\(https:\/\/example\.com\/#.+\/[^)]+\)/);
});

test("web page recording is stored as a replay and linked from the issue", async () => {
  const cookie = await login();
  const slug = `replay-${Date.now()}`;
  await createProject(cookie, slug);

  const json = JSON.stringify({ v: 1, url: "https://shop.test/cart", viewport: { w: 1280, h: 800 }, events: [{ type: 4, timestamp: 1 }, { type: 2, timestamp: 2 }] });
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "Discount button breaks the total");
  form.append("media", new File([gz], "replay.json.gz", { type: "application/gzip" }));
  form.append("media_kind", "recording");
  form.append("media_seconds", "12");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);
  const issue = ghCalls.at(-1)?.body.body as string;
  const link = issue.match(/\[▶ Watch session replay \(12s\)\]\((https:\/\/example\.com\/replay\/(p\/[^)]+\.rrweb\.gz))\)/);
  expect(link).not.toBeNull();

  const page = await SELF.fetch(link![1]!);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
  expect(await page.text()).toContain('<script src="/replay-player.js">');

  const media = await SELF.fetch(`https://example.com/f/${link![2]}`);
  expect(media.headers.get("content-type")).toBe("application/gzip");
  const back = await new Response(media.body!.pipeThrough(new DecompressionStream("gzip"))).json();
  expect(back).toEqual(JSON.parse(json));

  expect((await SELF.fetch("https://example.com/replay/p/x/f/y.png")).status).toBe(404);
});

test("rejected media mismatch and empty text", async () => {
  const cookie = await login();
  const slug = `bad-${Date.now()}`;
  await createProject(cookie, slug);

  const pngAsRec = new FormData();
  pngAsRec.append("project", slug);
  pngAsRec.append("kind", "issue");
  pngAsRec.append("text", "x".repeat(10));
  pngAsRec.append("media", pngFile());
  pngAsRec.append("media_kind", "recording");
  pngAsRec.append("media_seconds", "10");
  const wrong = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: pngAsRec });
  expect(wrong.status).toBe(415);

  const noText = new FormData();
  noText.append("project", slug);
  noText.append("kind", "feature_request");
  noText.append("text", "");
  const empty = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: noText });
  expect(empty.status).toBe(400);
});

test("rate limit kicks in at 21 submissions per hour", async () => {
  const cookie = await login();
  const slug = `rl-${Date.now()}`;
  await createProject(cookie, slug);
  let last = 0;
  for (let i = 0; i < 22; i++) {
    const form = new FormData();
    form.append("project", slug);
    form.append("kind", "feature_request");
    form.append("text", "dark mode please " + i);
    last = (await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form })).status;
  }
  expect(last).toBe(429);
});

test("demo page works from a fresh install: slug demo is provisioned", async () => {
  const demo = await SELF.fetch("https://example.com/demo");
  expect(demo.status).toBe(200);

  const form = new FormData();
  form.append("project", "demo");
  form.append("kind", "other");
  form.append("text", "broken checkout from the demo page");
  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).not.toBe(404);

  const again = await SELF.fetch("https://example.com/demo");
  expect(again.status).toBe(200);
});

test("unknown project 404s", async () => {
  const form = new FormData();
  form.append("project", "ghost");
  form.append("kind", "issue");
  form.append("text", "hello");
  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(404);
});

test("feedback with voice note only creates issue with audio link", async () => {
  const cookie = await login();
  const slug = `voice-${Date.now()}`;
  await createProject(cookie, slug);

  const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "feature_request");
  form.append("text", "Please add dark mode");
  form.append("audio", new File([WEBM], "voice.webm", { type: "audio/webm" }));
  form.append("audio_seconds", "31");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);
  const data: any = await res.json();
  expect(data.state).toBe("created");

  const gh = ghCalls.at(-1);
  expect(gh?.body.body).toContain("[Voice note (31s)](");

  const link = gh?.body.body.match(/\]\(([^)]+)\)/)?.[1] ?? "";
  const audioRes = await SELF.fetch("https://example.com" + new URL(link).pathname);
  expect(audioRes.status).toBe(200);
  expect(audioRes.headers.get("content-type")).toBe("audio/webm");
});

test("audio without seconds is rejected", async () => {
  const cookie = await login();
  const slug = `audio-bad-${Date.now()}`;
  await createProject(cookie, slug);

  const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "other");
  form.append("text", "missing seconds");
  form.append("audio", new File([WEBM], "voice.webm", { type: "audio/webm" }));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
});

const pngWith = (fill: number) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, fill, fill, fill, fill])], `shot-${fill}.png`, { type: "image/png" });

test("five images are stored and embedded in order", async () => {
  const cookie = await login();
  const slug = `img5-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "five shots of the broken dialog");
  for (let i = 1; i <= 5; i++) form.append("image", pngWith(i));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)?.body.body as string;
  for (let i = 1; i <= 5; i++) {
    expect(body).toContain(`![image ${i}](https://example.com/f/p/`);
  }
  expect(body).not.toContain("![image 6](");

  const page = await feedbackPage(cookie, slug);
  const row = page.feedback[0];
  expect(row.kind).toBe("issue");
  expect(row.media_kind).toBe("none");
  expect(row.images.length).toBe(5);
  const keys = row.images as string[];
  const orderInBody = keys.map((k) => body.indexOf(`https://example.com/f/${k}`));
  expect(orderInBody.every((idx) => idx > -1)).toBe(true);
  expect([...orderInBody].sort((a, b) => a - b)).toEqual(orderInBody);

  const media = await SELF.fetch(`https://example.com/f/${keys[4]}`);
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
});

test("sixth image is rejected with at most 5 images", async () => {
  const cookie = await login();
  const slug = `img6-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "too many shots");
  for (let i = 1; i <= 6; i++) form.append("image", pngWith(i));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
  expect(((await res.json()) as any).error).toContain("at most 5 images");
});

test("legacy screenshot counts as the first image against the cap of 5", async () => {
  const cookie = await login();
  const slug = `legacy5-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "other");
  form.append("text", "one legacy shot plus four");
  form.append("media", pngWith(99));
  form.append("media_kind", "screenshot");
  for (let i = 1; i <= 4; i++) form.append("image", pngWith(i));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)?.body.body as string;
  expect(body).toContain("![image 1](");
  expect(body).toContain("![image 5](");

  const page = await feedbackPage(cookie, slug);
  expect(page.feedback[0].images.length).toBe(5);
  expect(page.feedback[0].media_kind).toBe("none");
});

test("legacy screenshot plus five images exceeds the cap", async () => {
  const cookie = await login();
  const slug = `legacy6-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "one too many");
  form.append("media", pngWith(98));
  form.append("media_kind", "screenshot");
  for (let i = 1; i <= 5; i++) form.append("image", pngWith(i));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
  expect(((await res.json()) as any).error).toContain("at most 5 images");
});

test("video sent as an image part is rejected by the sniff", async () => {
  const cookie = await login();
  const slug = `vidimg-${Date.now()}`;
  await createProject(cookie, slug);

  const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "video in the image slot");
  form.append("image", new File([WEBM], "clip.webm", { type: "video/webm" }));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(415);
});

test("two recording media parts are rejected", async () => {
  const cookie = await login();
  const slug = `tworec-${Date.now()}`;
  await createProject(cookie, slug);

  const json = JSON.stringify({ v: 1, events: [{ type: 4, timestamp: 1 }] });
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "tried to send two replays");
  form.append("media", new File([gz], "a.json.gz", { type: "application/gzip" }));
  form.append("media", new File([gz], "b.json.gz", { type: "application/gzip" }));
  form.append("media_kind", "recording");
  form.append("media_seconds", "12");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
  expect(((await res.json()) as any).error).toContain("only one recording per report");
});

test("valid metadata and reporter identity round-trip through the dashboard api", async () => {
  const cookie = await login();
  const slug = `meta-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "feature_request");
  form.append("text", "add keyboard shortcuts");
  form.append("reporter_name", "Ada Lovelace");
  form.append("reporter_id", "user_42");
  form.append("metadata", JSON.stringify({ plan: "pro", build: 4211, beta: true }));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const page = await feedbackPage(cookie, slug);
  const row = page.feedback[0];
  expect(row.reporter_name).toBe("Ada Lovelace");
  expect(row.reporter_id).toBe("user_42");
  expect(JSON.parse(row.metadata)).toEqual({ plan: "pro", build: 4211, beta: true });
  expect(row.kind).toBe("feature_request");

  // PII never reaches the issue body
  const body = ghCalls.at(-1)?.body.body as string;
  expect(body).not.toContain("Ada Lovelace");
  expect(body).not.toContain("user_42");
  expect(body).not.toContain("pro");
  expect(body).toContain("Reporter details and context are in FeedbackBee (private)");
});

test.each([
  ["oversize", JSON.stringify({ big: "x".repeat(4100) })],
  ["too many keys", JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i])))],
  ["bad key", JSON.stringify({ "bad key!": "v" })],
  ["nested object", JSON.stringify({ outer: { inner: "v" } })],
  ["array", JSON.stringify([1, 2, 3])],
  ["not json", "{oops"],
])("metadata %s is rejected with 400", async (_label, payload: string) => {
  const cookie = await login();
  const slug = `metabad-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "bad metadata attached");
  form.append("metadata", payload);

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
});

test("reporter caps: oversized name and id are dropped, not rejected", async () => {
  const cookie = await login();
  const slug = `caps-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "long identity fields");
  form.append("reporter_name", "x".repeat(121));
  form.append("reporter_id", "y".repeat(129));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const page = await feedbackPage(cookie, slug);
  expect(page.feedback[0].reporter_name).toBeNull();
  expect(page.feedback[0].reporter_id).toBeNull();
});

test("images ride along with a recording on the same report", async () => {
  const cookie = await login();
  const slug = `recimg-${Date.now()}`;
  await createProject(cookie, slug);

  const json = JSON.stringify({ v: 1, events: [{ type: 4, timestamp: 1 }] });
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "replay with two screenshots");
  form.append("media", new File([gz], "replay.json.gz", { type: "application/gzip" }));
  form.append("media_kind", "recording");
  form.append("media_seconds", "8");
  form.append("image", pngWith(1));
  form.append("image", pngWith(2));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);

  const body = ghCalls.at(-1)?.body.body as string;
  const img1 = body.indexOf("![image 1](");
  const img2 = body.indexOf("![image 2](");
  const replay = body.indexOf("[\u25b6 Watch session replay (8s)]");
  expect(img1).toBeGreaterThan(-1);
  expect(img2).toBeGreaterThan(img1);
  expect(replay).toBeGreaterThan(img2);

  const page = await feedbackPage(cookie, slug);
  const row = page.feedback[0];
  expect(row.media_kind).toBe("recording");
  expect(row.images.length).toBe(2);
});

test("metadata part present but empty is treated as absent", async () => {
  const cookie = await login();
  const slug = `emptymeta-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "no metadata really");
  form.append("metadata", "");

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(201);
  const page = await feedbackPage(cookie, slug);
  expect(page.feedback[0].metadata).toBeNull();
});

test("oversized single image is rejected with 413", async () => {
  const cookie = await login();
  const slug = `bigimg-${Date.now()}`;
  await createProject(cookie, slug);

  const big = new File([new Uint8Array(11 * 1024 * 1024)], "huge.png", { type: "image/png" });
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "one huge image");
  form.append("image", big);

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(413);
});

test("combined image bytes over 50MB are rejected with 413", async () => {
  const cookie = await login();
  const slug = `comb-${Date.now()}`;
  await createProject(cookie, slug);

  // 4 x 13 MB: over 50 MB combined. The combined check fires before the
  // per-image 10 MB check in the loop, so this reaches the combined cap.
  const mb13 = new Uint8Array(13 * 1024 * 1024);
  mb13.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "issue");
  form.append("text", "four chunky images");
  for (let i = 0; i < 4; i++) form.append("image", new File([mb13], `big-${i}.png`, { type: "image/png" }));

  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(413);
  expect(((await res.json()) as any).error).toContain("combined");
});

test("unknown kind is rejected", async () => {
  const cookie = await login();
  const slug = `unk-${Date.now()}`;
  await createProject(cookie, slug);

  const form = new FormData();
  form.append("project", slug);
  form.append("kind", "complaint");
  form.append("text", "no such kind");
  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(400);
});

test("all legacy kind values map to their new names", async () => {
  const cookie = await login();
  const slug = `legacymap-${Date.now()}`;
  await createProject(cookie, slug);
  const pairs = [
    ["bug", "issue"],
    ["idea", "feature_request"],
    ["feedback", "other"],
  ] as const;
  const titles: string[] = [];
  for (const [legacy, stored] of pairs) {
    const form = new FormData();
    form.append("project", slug);
    form.append("kind", legacy);
    form.append("text", `legacy ${legacy} submission`);
    const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
    expect(res.status).toBe(201);
    titles.push(ghCalls.at(-1)?.body.title as string);
    const page = await feedbackPage(cookie, slug);
    const row = page.feedback.find((f: any) => f.text === `legacy ${legacy} submission`);
    expect(row.kind).toBe(stored);
  }
  expect(titles[0]).toMatch(/^Issue:/);
  expect(titles[1]).toMatch(/^Feature request:/);
  expect(titles[2]).toMatch(/^Other:/);
});

// D1's exec() splits on newlines, so multi-statement SQL is split on
// statement-ending semicolons and run one prepared statement at a time.
async function execAll(db: D1Database, sql: string) {
  for (const stmt of sql.split(/;\s*(?:\n|$)/)) {
    const trimmed = stmt.trim();
    if (trimmed) await db.prepare(trimmed).run();
  }
}

test("migration 0005 maps kinds, backfills screenshots to position 0, rewrites labels", async () => {
  const mig = env.TEST_MIGRATIONS.find((m) => m.name === "0005_attachments.sql") as
    | { name: string; queries: string[] }
    | undefined;
  expect(mig).toBeDefined();

  // Stash the migrated schema, rebuild the pre-0005 shape, then run the
  // shipped migration file verbatim against it.
  await execAll(env.DB, `
    DROP TABLE IF EXISTS feedback_image;
    DROP INDEX IF EXISTS idx_feedback_project;
    ALTER TABLE feedback RENAME TO feedback_migrated;
    CREATE TABLE feedback (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('bug','idea','feedback')),
      text TEXT NOT NULL,
      reporter_email TEXT,
      url TEXT,
      user_agent TEXT,
      screen_w INTEGER,
      screen_h INTEGER,
      media_kind TEXT NOT NULL DEFAULT 'none' CHECK (media_kind IN ('none','screenshot','recording')),
      media_key TEXT,
      media_seconds REAL,
      audio_key TEXT,
      audio_seconds REAL,
      app_version TEXT,
      os_name TEXT,
      os_version TEXT,
      device_model TEXT,
      issue_number INTEGER,
      issue_url TEXT,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','created','issue_error','deleted')),
      issue_error TEXT,
      created_at INTEGER NOT NULL
    );
    INSERT INTO project (id, name, slug, github_repo, labels_map, created_at)
      VALUES ('mig-proj', 'Mig', 'mig', 'o/r', '{"bug":"bug","idea":"enhancement","feedback":"feedback"}', 1);
    INSERT INTO feedback (id, project_id, kind, text, media_kind, media_key, created_at) VALUES
      ('mig-f1', 'mig-proj', 'bug', 'legacy bug', 'screenshot', 'p/mig/f/old.png', 1),
      ('mig-f2', 'mig-proj', 'idea', 'legacy idea', 'none', NULL, 2),
      ('mig-f3', 'mig-proj', 'feedback', 'legacy feedback', 'recording', 'p/mig/f/old.rrweb.gz', 3);
  `);

  await execAll(env.DB, mig!.queries.join(";\n"));

  const { results } = await env.DB.prepare(
    "SELECT f.id, f.kind, f.media_kind, f.media_key, f.reporter_name, f.metadata, i.position AS img_pos, i.key AS img_key " +
      "FROM feedback f LEFT JOIN feedback_image i ON i.feedback_id = f.id ORDER BY f.id",
  ).all<any>();
  const byId = new Map(results.map((r: any) => [r.id, r]));
  expect(byId.get("mig-f1")).toMatchObject({ kind: "issue", media_kind: "screenshot", img_pos: 0, img_key: "p/mig/f/old.png" });
  expect(byId.get("mig-f2")).toMatchObject({ kind: "feature_request", img_pos: null });
  expect(byId.get("mig-f3")).toMatchObject({ kind: "other", media_kind: "recording", img_pos: null });

  const labels = await env.DB.prepare("SELECT labels_map FROM project WHERE id = 'mig-proj'").first<any>();
  expect(JSON.parse(labels.labels_map)).toEqual({ issue: "bug", feature_request: "enhancement", other: "feedback" });

  // Restore the real (already-migrated) schema for any later tests.
  await execAll(env.DB, `
    DELETE FROM project WHERE id = 'mig-proj';
    DROP TABLE feedback;
    DROP TABLE feedback_image;
    ALTER TABLE feedback_migrated RENAME TO feedback;
    CREATE TABLE feedback_image (
      feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      key TEXT NOT NULL,
      PRIMARY KEY (feedback_id, position)
    );
    CREATE INDEX idx_feedback_project ON feedback(project_id, created_at DESC);
  `);
});
