import { SELF, env } from "cloudflare:test";
import { expect, test } from "vitest";
import { OWNER, ORIGIN, api, createProject, login } from "./helpers";

// Auth (groot core + the first-owner bootstrap), the dashboard API and the
// public scripts. Tests share one D1, so the owner exists after the first login.

test("the first sign-in creates the owner; later strangers are refused", async () => {
  const cookie = await login();
  expect(cookie).toMatch(/^token=/);

  const me = await api(cookie, "/auth/me");
  expect(me.status).toBe(200);
  expect(me.body.data.email).toBe(OWNER.email);

  const stranger = await SELF.fetch(`${ORIGIN}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "intruder@test.dev", password: "letmein123" }),
  });
  expect(stranger.status).toBe(401);
  const wrongPassword = await SELF.fetch(`${ORIGIN}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: OWNER.email, password: "not-the-password" }),
  });
  expect(wrongPassword.status).toBe(401);
  const owners = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  expect(owners?.n).toBe(1);
});

test("the dashboard API requires a session", async () => {
  for (const [method, path] of [
    ["GET", "/projects"],
    ["POST", "/projects"],
    ["GET", "/projects/x/feedback"],
    ["DELETE", "/projects/x"],
  ]) {
    const res = await SELF.fetch(`${ORIGIN}/api/v1${path}`, { method });
    expect(res.status, `${method} ${path}`).toBe(401);
  }
});

test("project CRUD round-trips in the envelope and never exposes the token", async () => {
  const cookie = await login();
  const created = await createProject(cookie, "crud");
  const list = await api(cookie, "/projects");
  expect(list.status).toBe(200);
  expect(list.body.success).toBe(true);
  expect(list.body.data.find((p: { id: string }) => p.id === created.id)).toMatchObject({
    name: "My App",
    githubRepo: "ashik/myapp",
    labels: { issue: "bug", feature_request: "enhancement", other: "feedback" },
  });
  expect(JSON.stringify(list.body)).not.toContain("ghp_");

  const patched = await api(cookie, `/projects/${created.id}`, {
    method: "PATCH",
    body: { name: "Renamed", githubRepo: "ashik/other", labels: { issue: "triage" } },
  });
  expect(patched.status).toBe(200);
  expect(patched.body.data).toMatchObject({
    name: "Renamed",
    githubRepo: "ashik/other",
    labels: { issue: "triage" },
    slug: created.slug,
  });

  expect((await api(cookie, `/projects/${created.id}`, { method: "DELETE" })).status).toBe(200);
  expect((await api(cookie, `/projects/${created.id}`)).status).toBe(404);
});

test.each([
  ["a duplicate project id", (slug: string) => ({ slug }), 409],
  ["a bad project id", () => ({ slug: "No Spaces!" }), 400],
  ["a bad repo", () => ({ githubRepo: "not-a-repo" }), 400],
])("project create rejects %s", async (_label, override, status) => {
  const cookie = await login();
  const existing = await createProject(cookie, "dup");
  const res = await api(cookie, "/projects", {
    method: "POST",
    body: { name: "X", slug: `ok-${Date.now()}`, githubRepo: "a/b", ...override(existing.slug) },
  });
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
});

test("feedback pages are cursor-paginated, newest first", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "page");
  const now = Date.now();
  // 27 rows straight into D1: the submit path is rate limited at 20/hour.
  await env.DB.batch(
    Array.from({ length: 27 }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO feedback (id, project_id, kind, text, state, created_at) VALUES (?, ?, 'other', ?, 'created', ?)",
      ).bind(`page-${i}`, p.id, `item ${i}`, now - i * 1000),
    ),
  );

  const first = await api(cookie, `/projects/${p.id}/feedback`);
  expect(first.body.data.items).toHaveLength(25);
  expect(first.body.data.hasMore).toBe(true);
  expect(first.body.data.items[0].text).toBe("item 0");

  const cursor = Date.parse(first.body.data.items.at(-1).createdAt);
  const second = await api(cookie, `/projects/${p.id}/feedback?before=${cursor}`);
  expect(second.body.data.items.map((f: { text: string }) => f.text)).toEqual([
    "item 25",
    "item 26",
  ]);
  expect(second.body.data.hasMore).toBe(false);
});

test("health and the widget scripts are public, with their cache headers", async () => {
  expect((await SELF.fetch(`${ORIGIN}/health`)).status).toBe(200);

  const embed = await SELF.fetch(`${ORIGIN}/embed.js`);
  expect(embed.status).toBe(200);
  expect(embed.headers.get("content-type")).toContain("application/javascript");
  expect(embed.headers.get("cache-control")).toContain("max-age=300");
  expect(await embed.text()).toContain("/api/v1/feedback");

  for (const path of ["/embed-capture.js", "/embed-record.js", "/replay-player.js"]) {
    const res = await SELF.fetch(`${ORIGIN}${path}`);
    expect(res.status, path).toBe(200);
    expect(res.headers.get("cache-control"), path).toContain("max-age=86400");
  }
  expect((await SELF.fetch(`${ORIGIN}/f/not-a-media-key`)).status).toBe(404);
});

test("zero-config boot: groot's production secrets are generated once and kept in D1", async () => {
  const rows = await env.DB.prepare(
    "SELECT key FROM kv WHERE key LIKE 'feedbackbee:%' ORDER BY key",
  ).all<{ key: string }>();
  expect(rows.results.map((r) => r.key)).toEqual([
    "feedbackbee:admin_auth_key",
    "feedbackbee:jwt_secret_key",
  ]);
});
