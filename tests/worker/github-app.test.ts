import { env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { hashPassword } from "@groot/core/utils/password.utils";
import { ghAuthCalls, network, stubGithubApp } from "./gh-server";
import { ORIGIN, OWNER, api, login } from "./helpers";

const base = `${ORIGIN}/api/v1/github`;

beforeAll(() => network.enable());
beforeEach(() => {
  network.resetHandlers();
  stubGithubApp();
  ghAuthCalls.length = 0;
});
afterAll(() => network.disable());

function flowCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function startManifest(cookie: string, origin = ORIGIN) {
  const response = await SELF.fetch(`${base}/manifest`, {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  return { response, cookie: flowCookie(response), body: (await response.json()) as any };
}

async function startInstall(cookie: string) {
  const response = await SELF.fetch(`${base}/install`, {
    method: "POST",
    headers: { cookie, origin: ORIGIN },
  });
  return { response, cookie: flowCookie(response), body: (await response.json()) as any };
}

function stateFrom(url: string) {
  return new URL(url).searchParams.get("state")!;
}

async function callback(path: string, cookie: string, query: Record<string, string>) {
  const url = new URL(`${ORIGIN}/api/v1/github/${path}`);
  url.search = new URLSearchParams(query).toString();
  return SELF.fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
}

test("GitHub settings require auth and expose no credential fields", async () => {
  const unauthenticated = await SELF.fetch(base);
  expect(unauthenticated.status).toBe(401);

  const cookie = await login();
  const settings = await api(cookie, "/github");
  expect(settings.status).toBe(200);
  expect(settings.body.data).toMatchObject({
    encryptionConfigured: true,
    app: null,
    repositories: [],
    connectionError: null,
  });
  expect(JSON.stringify(settings.body)).not.toMatch(/private.?key|pem|token/i);
});

test("manifest registration binds callback to the flow cookie and consumes state once", async () => {
  const session = await login();
  const started = await startManifest(session);
  expect(started.response.status).toBe(200);
  expect(started.cookie).toMatch(/^feedbackbee_github_flow=/);
  expect(started.response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  expect(started.response.headers.get("set-cookie")).toMatch(/Secure/i);
  expect(started.response.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  expect(started.response.headers.get("set-cookie")).toContain("Path=/api/v1/github");
  expect(started.body.data.url).toContain(`state=${stateFrom(started.body.data.url)}`);
  expect(started.body.data.manifest).toMatchObject({
    redirect_url: `${ORIGIN}/api/v1/github/callback`,
    public: false,
    default_permissions: { issues: "write" },
    hook_attributes: { active: false },
  });

  const state = stateFrom(started.body.data.url);
  const missingCookie = await callback("callback", "", { state, code: "manifest-code" });
  expect(missingCookie.status).toBe(302);
  expect(missingCookie.headers.get("location")).toBe("/app/settings?github=error");

  const badState = await callback("callback", started.cookie, { state: `${state}x`, code: "manifest-code" });
  expect(badState.headers.get("location")).toBe("/app/settings?github=error");

  const connected = await callback("callback", started.cookie, { state, code: "manifest-code" });
  expect(connected.status).toBe(302);
  expect(connected.headers.get("location"), JSON.stringify({ ghAuthCalls, state, cookie: started.cookie, setCookie: started.response.headers.get("set-cookie") })).toBe("/app/settings?github=connected");
  expect(connected.headers.get("referrer-policy")).toBe("no-referrer");
  const replay = await callback("callback", started.cookie, { state, code: "manifest-code" });
  expect(replay.headers.get("location")).toBe("/app/settings?github=error");

  const saved = await env.DB.prepare("SELECT app_id, slug, name, private_key FROM github_apps WHERE id=1").first<any>();
  expect(saved).toMatchObject({ app_id: 321, slug: "feedbackbee-test", name: "FeedbackBee test" });
  expect(saved.private_key).toMatch(/^v1\.[^.]+\.[^.]+$/);
  expect(saved.private_key).not.toContain("BEGIN PRIVATE KEY");
});

test("manifest setup rejects cross-origin mutations and expired flow state", async () => {
  const session = await login();
  const crossOrigin = await SELF.fetch(`${base}/manifest`, {
    method: "POST",
    headers: { cookie: session, origin: "https://attacker.test", "content-type": "application/json" },
    body: "{}",
  });
  expect(crossOrigin.status).toBe(403);

  // The prior registration installed an app, so disconnect before testing another manifest flow.
  await api(session, "/github/disconnect", { method: "POST" });
  const started = await startManifest(session);
  const state = stateFrom(started.body.data.url);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  const stateHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("UPDATE github_flows SET expires_at=0 WHERE state=?").bind(stateHash).run();
  const expired = await callback("callback", started.cookie, { state, code: "manifest-code" });
  expect(expired.headers.get("location")).toBe("/app/settings?github=error");
  const reconnect = await startManifest(session);
  const reconnectState = stateFrom(reconnect.body.data.url);
  expect((await callback("callback", reconnect.cookie, { state: reconnectState, code: "manifest-code" }))
    .headers.get("location")).toBe("/app/settings?github=connected");
});

test("installation callback ignores untrusted ids and lists app repositories", async () => {
  const session = await login();
  const started = await startInstall(session);
  expect(started.response.status).toBe(200);
  const state = stateFrom(started.body.data.url);
  const forged = await callback("installed", started.cookie, { state, installation_id: "9999" });
  expect(forged.headers.get("location")).toBe("/app/settings?github=error");

  const validStart = await startInstall(session);
  const validState = stateFrom(validStart.body.data.url);
  const installed = await callback("installed", validStart.cookie, { state: validState, installation_id: "701" });
  expect(installed.headers.get("location")).toBe("/app/settings?github=installed");

  const listed = await api(session, "/github/repositories");
  expect(listed.status).toBe(200);
  expect(listed.body.data).toEqual([{ id: 902, fullName: "ashik/myapp", installationId: 701 }]);
});

test("disconnect removes app credentials without deleting existing project data", async () => {
  const session = await login();
  const projectResponse = await api(session, "/projects", {
    method: "POST",
    body: { name: "Retained", slug: "retained", githubRepo: "ashik/myapp" },
  });
  // This test runs after app registration, and project access is verified via the App token.
  expect(projectResponse.status).toBe(201);
  const id = projectResponse.body.data.id;
  const result = await api(session, "/github/disconnect", { method: "POST" });
  expect(result.body.data).toEqual({ disconnected: true });
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM github_apps").first()).toMatchObject({ n: 0 });
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM projects WHERE id=?").bind(id).first()).toMatchObject({ n: 1 });
});

test("only the first database user can manage the GitHub App", async () => {
  await login();
  const password = await hashPassword("second-password");
  const now = Date.now();
  await env.DB.prepare("INSERT INTO users (email, password, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind("other@test.dev", password, now, now).run();
  const loginResponse = await SELF.fetch(`${ORIGIN}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "other@test.dev", password: "second-password" }),
  });
  expect(loginResponse.status).toBe(200);
  const otherCookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect((await SELF.fetch(base, { headers: { cookie: otherCookie } })).status).toBe(403);
});
