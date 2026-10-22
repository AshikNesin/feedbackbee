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

test("feedback with screenshot creates issue and stores media", async () => {
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
  expect(gh?.body.labels).toEqual(["bug"]);
  expect(gh?.body.body).toContain("![screenshot](");

  const projects: any = await (await SELF.fetch("https://example.com/api/projects", { headers: { cookie } })).json();
  const proj = projects.projects.find((p: any) => p.slug === slug);
  const detail = await SELF.fetch(`https://example.com/api/projects/${proj.id}/feedback`, { headers: { cookie } });
  const page: any = await detail.json();
  expect(page.feedback[0].media_kind).toBe("screenshot");
  const key = page.feedback[0].media_key;
  expect(key).toMatch(/^p\/.+\.png$/);
  const media = await SELF.fetch(`https://example.com/f/${key}`);
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toBe("image/png");
});

test("rejected media mismatch and empty text", async () => {
  const cookie = await login();
  const slug = `bad-${Date.now()}`;
  await createProject(cookie, slug);

  const pngAsRec = new FormData();
  pngAsRec.append("project", slug);
  pngAsRec.append("kind", "bug");
  pngAsRec.append("text", "x".repeat(10));
  pngAsRec.append("media", pngFile());
  pngAsRec.append("media_kind", "recording");
  pngAsRec.append("media_seconds", "10");
  const wrong = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: pngAsRec });
  expect(wrong.status).toBe(415);

  const noText = new FormData();
  noText.append("project", slug);
  noText.append("kind", "bug");
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
    form.append("kind", "idea");
    form.append("text", "dark mode please " + i);
    last = (await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form })).status;
  }
  expect(last).toBe(429);
});

test("unknown project 404s", async () => {
  const form = new FormData();
  form.append("project", "ghost");
  form.append("kind", "bug");
  form.append("text", "hello");
  const res = await SELF.fetch("https://example.com/api/feedback", { method: "POST", body: form });
  expect(res.status).toBe(404);
});
