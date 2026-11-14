import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { inQuietHours } from "../../apps/web/src/server/lib/quiet-hours";
import { network, pushCalls, stubGithub, stubGithubApp, stubPushover } from "./gh-server";
import { api, createProject, login, submit } from "./helpers";

// Pushover push notifications: Settings → Push notifications decides when,
// for which feedback and with what; the keys are env vars (test bindings).

const filed = () => {
  stubGithubApp();
  stubGithub(() => ({
    status: 201,
    json: { number: 9, html_url: "https://github.com/ashik/myapp/issues/9" },
  }));
};
const refused = () => {
  stubGithubApp();
  stubGithub(() => ({ status: 410, json: { message: "Issues are disabled for this repo" } }));
};

beforeAll(() => network.enable());
beforeEach(async () => {
  network.resetHandlers();
  filed();
  pushCalls.length = 0;
  await save({}); // back to the defaults
});
afterEach(() => vi.useRealTimers());
afterAll(() => network.disable());

async function save(settings: Record<string, unknown>) {
  const res = await api(await login(), "/notifications", { method: "PUT", body: settings });
  expect(res.status).toBe(200);
  return res.body.data;
}

/** Wait for `count` pushes (sending runs in the background), then return them all. */
async function pushes(count: number) {
  await vi.waitFor(() => expect(pushCalls.length).toBeGreaterThanOrEqual(count));
  return pushCalls;
}

async function project(prefix: string) {
  const cookie = await login();
  return createProject(cookie, prefix);
}

test("settings default to on for new feedback and report that Pushover is configured", async () => {
  const res = await api(await login(), "/notifications");
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({
    configured: true,
    settings: {
      enabled: true,
      events: { newFeedback: true, issueError: true, statusChange: false },
      kinds: ["issue", "feature_request", "other"],
      projectIds: [],
      content: { text: true, reporter: false, context: false },
      priority: 0,
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "07:00",
        timeZone: "UTC",
        mode: "silent",
      },
    },
  });
});

test("settings are validated and kept", async () => {
  const cookie = await login();
  for (const body of [
    { quietHours: { timeZone: "Mars/Olympus" } },
    { quietHours: { start: "25:00" } },
    { priority: 2 },
    { kinds: ["bug"] },
    { quietHours: { start: "08:00", end: "08:00" } },
  ]) {
    const res = await api(cookie, "/notifications", { method: "PUT", body });
    expect(res.status, JSON.stringify(body)).toBe(400);
  }

  const data = await save({
    kinds: ["issue"],
    priority: 1,
    quietHours: { enabled: true, timeZone: "Asia/Kolkata" },
  });
  expect(data.settings.kinds).toEqual(["issue"]);
  expect(data.settings.quietHours).toMatchObject({ enabled: true, timeZone: "Asia/Kolkata" });
  const res = await api(cookie, "/notifications");
  expect(res.body.data.settings).toEqual(data.settings);
});

test("the settings need a signed-in owner", async () => {
  const res = await api("", "/notifications");
  expect(res.status).toBe(401);
});

test("new feedback sends the text and a dashboard link, never the reporter by default", async () => {
  const p = await project("push");
  await submit({
    project: p.slug,
    kind: "feature_request",
    text: "Dark mode please",
    email: "jane@example.com",
    reporter_name: "Jane",
  });

  const [push] = await pushes(1);
  expect(push).toMatchObject({
    token: "test-pushover-token",
    user: "test-pushover-user",
    title: "My App: new feature request",
    message: "Dark mode please",
    priority: "0",
    url_title: "Open in FeedbackBee",
  });
  expect(push!.url).toMatch(new RegExp(`/app/projects/${p.slug}\\?feedback=`));
  expect(JSON.stringify(push)).not.toContain("jane@example.com");
});

test("the reporter and device context are included when chosen", async () => {
  const p = await project("push-what");
  await save({ content: { text: false, reporter: true, context: true } });
  await submit({
    project: p.slug,
    kind: "issue",
    text: "secret details",
    email: "jane@example.com",
    reporter_name: "Jane",
    url: "https://shop.example.com/cart",
    os_name: "iOS",
    os_version: "18.1",
  });

  const [push] = await pushes(1);
  expect(push!.message).toBe(
    "From: Jane <jane@example.com>\nPage: https://shop.example.com/cart\nDevice: iOS 18.1",
  );
});

test("a long report keeps the reporter and context lines inside Pushover's limit", async () => {
  const p = await project("push-long");
  await save({ content: { text: true, reporter: true, context: true } });
  await submit({
    project: p.slug,
    kind: "issue",
    text: "x".repeat(4000),
    email: "jane@example.com",
    os_name: "Android",
  });

  const [push] = await pushes(1);
  expect(push!.message.length).toBeLessThanOrEqual(1024);
  expect(push!.message).toMatch(/…\nFrom: <jane@example\.com>\nDevice: Android$/);
});

test("kind and project filters decide which feedback notifies", async () => {
  const watched = await project("watched");
  const ignored = await project("ignored");
  await save({ kinds: ["issue"], projectIds: [watched.id] });

  await submit({ project: watched.slug, kind: "other", text: "wrong kind" });
  await submit({ project: ignored.slug, kind: "issue", text: "wrong project" });
  await submit({ project: watched.slug, kind: "issue", text: "this one" });

  await pushes(1);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(pushCalls.map((push) => push.message)).toEqual(["this one"]);
});

test("a failed GitHub issue notifies even with new-feedback notifications off", async () => {
  network.resetHandlers();
  refused();
  const p = await project("push-error");
  await save({ events: { newFeedback: false, issueError: true } });
  const res = await submit({ project: p.slug, kind: "issue", text: "Broken checkout" });
  expect(res.status).toBe(202);

  const [push] = await pushes(1);
  expect(push!.title).toBe("My App: Issue (GitHub issue failed)");
  expect(push!.message).toMatch(/^Broken checkout\nGitHub issue not filed: /);
});

test("nothing is sent when notifications are off", async () => {
  const p = await project("push-off");
  await save({ enabled: false });
  await submit({ project: p.slug, kind: "issue", text: "quiet" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(pushCalls).toEqual([]);
});

test("quiet hours send silently, or not at all", async () => {
  const p = await project("push-quiet");
  // A window covering the whole day except one minute.
  const allDay = { enabled: true, start: "00:00", end: "23:59", timeZone: "UTC" };
  const now = new Date();
  const inWindow = now.getUTCHours() !== 23 || now.getUTCMinutes() !== 59;
  if (!inWindow) return; // the one minute outside the window

  await save({ quietHours: { ...allDay, mode: "silent" }, priority: 1 });
  await submit({ project: p.slug, kind: "issue", text: "at night" });
  const [push] = await pushes(1);
  expect(push!.priority).toBe("-2");

  pushCalls.length = 0;
  await save({ quietHours: { ...allDay, mode: "skip" } });
  await submit({ project: p.slug, kind: "issue", text: "skipped" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(pushCalls).toEqual([]);
});

test("quiet hours wrap past midnight in the chosen time zone", () => {
  const at = (iso: string) => new Date(iso);
  const night = { enabled: true, start: "22:00", end: "07:00", timeZone: "Asia/Kolkata" };
  // 17:00 UTC is 22:30 in Kolkata (UTC+5:30).
  expect(inQuietHours(night, at("2026-01-01T17:00:00Z"))).toBe(true);
  expect(inQuietHours(night, at("2026-01-01T01:00:00Z"))).toBe(true); // 06:30
  expect(inQuietHours(night, at("2026-01-01T01:30:00Z"))).toBe(false); // 07:00
  expect(inQuietHours(night, at("2026-01-01T10:00:00Z"))).toBe(false); // 15:30
  const day = { enabled: true, start: "09:00", end: "17:00", timeZone: "UTC" };
  expect(inQuietHours(day, at("2026-01-01T12:00:00Z"))).toBe(true);
  expect(inQuietHours(day, at("2026-01-01T17:00:00Z"))).toBe(false);
  expect(inQuietHours({ ...day, enabled: false }, at("2026-01-01T12:00:00Z"))).toBe(false);
});

test("a test notification goes through Pushover and reports its refusal", async () => {
  const cookie = await login();
  const ok = await api(cookie, "/notifications/test", { method: "POST" });
  expect(ok.status).toBe(200);
  expect(pushCalls.at(-1)).toMatchObject({ title: "FeedbackBee" });

  network.resetHandlers();
  stubPushover(400);
  const refusedRes = await api(cookie, "/notifications/test", { method: "POST" });
  expect(refusedRes.status).toBe(503);
  expect(refusedRes.body.error?.message ?? refusedRes.body.message).toMatch(/Pushover/);
});
