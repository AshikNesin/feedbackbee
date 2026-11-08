import { SELF, env } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { statusFromIssue } from "../../apps/web/src/server/lib/issue-status";
import { network, stubGithub, stubGithubApp } from "./gh-server";
import { ORIGIN, api, createProject, encryptForTest, login, submit } from "./helpers";

// Feedback status ⇄ GitHub issue sync: dashboard edits push to GitHub, the
// `issues` webhook and "Sync from GitHub" pull back.

const SECRET = "status-sync-webhook-secret"; // gitleaks:allow (test-only webhook secret)

type Issue = { state: "OPEN" | "CLOSED"; stateReason: string | null; labels: string[] };
/** The mocked repository's issues, by number. */
let issues: Map<number, Issue>;
let calls: Array<{ method: string; path: string; body: any }>;
let nextIssue = 100;

function stubIssues() {
  stubGithubApp();
  stubGithub(() => {
    const number = nextIssue++;
    issues.set(number, { state: "OPEN", stateReason: null, labels: ["bug"] });
    return {
      status: 201,
      json: { number, html_url: `https://github.com/ashik/myapp/issues/${number}` },
    };
  });
  const record = async (request: Request) => {
    const text = await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, path: new URL(request.url).pathname, body });
    return body;
  };
  network.use(
    http.patch(
      "https://api.github.com/repos/:owner/:repo/issues/:n",
      async ({ request, params }) => {
        const body = await record(request);
        const issue = issues.get(Number(params.n))!;
        issue.state = body.state === "open" ? "OPEN" : "CLOSED";
        issue.stateReason = body.state_reason?.toUpperCase() ?? null;
        return HttpResponse.json({ number: Number(params.n) });
      },
    ),
    http.post(
      "https://api.github.com/repos/:owner/:repo/issues/:n/labels",
      async ({ request, params }) => {
        const body = await record(request);
        issues.get(Number(params.n))!.labels.push(...body.labels);
        return HttpResponse.json([]);
      },
    ),
    http.delete(
      "https://api.github.com/repos/:owner/:repo/issues/:n/labels/:label",
      async ({ request, params }) => {
        await record(request);
        const issue = issues.get(Number(params.n))!;
        const label = decodeURIComponent(String(params.label));
        if (!issue.labels.includes(label)) return HttpResponse.json({}, { status: 404 });
        issue.labels = issue.labels.filter((l) => l !== label);
        return HttpResponse.json([]);
      },
    ),
    http.post("https://api.github.com/graphql", async ({ request }) => {
      const body = await record(request);
      const repository: Record<string, unknown> = {};
      for (const [, alias, n] of body.query.matchAll(/(i\d+): issue\(number: (\d+)\)/g)) {
        const issue = issues.get(Number(n));
        repository[alias] = issue
          ? {
              state: issue.state,
              stateReason: issue.stateReason,
              labels: { nodes: issue.labels.map((name) => ({ name })) },
            }
          : null;
      }
      return HttpResponse.json({ data: { repository } });
    }),
  );
}

beforeAll(() => network.enable());
beforeEach(() => {
  network.resetHandlers();
  issues = new Map();
  calls = [];
  stubIssues();
});
afterAll(() => network.disable());

async function report(cookie: string, projectSlug: string, projectId: string, text: string) {
  const res = await submit({ project: projectSlug, kind: "issue", text });
  // 201 filed, 202 stored but the issue failed.
  expect([201, 202]).toContain(res.status);
  const { body } = await api(cookie, `/projects/${projectId}/feedback`);
  return body.data.items.find((item: any) => item.id === res.body.data.id);
}

async function sign(body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function webhook(payload: unknown, event = "issues", signature?: string) {
  const body = JSON.stringify(payload);
  return SELF.fetch(`${ORIGIN}/api/v1/github/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": signature ?? (await sign(body)),
    },
    body,
  });
}

test("issue snapshots map to statuses", () => {
  const open = { state: "open" as const, stateReason: null, labels: [] };
  expect(statusFromIssue(open)).toBe("open");
  expect(statusFromIssue({ ...open, labels: ["bug", "In Progress"] })).toBe("in_progress");
  expect(statusFromIssue({ ...open, state: "closed", stateReason: "COMPLETED" })).toBe("done");
  expect(statusFromIssue({ ...open, state: "closed", stateReason: null })).toBe("done");
  expect(statusFromIssue({ ...open, state: "closed", stateReason: "not_planned" })).toBe(
    "wont_fix",
  );
  expect(statusFromIssue({ ...open, state: "closed", stateReason: "DUPLICATE" })).toBe("wont_fix");
});

test("new feedback is open; the list filters by status", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "filter");
  const a = await report(cookie, p.slug, p.id, "first");
  const b = await report(cookie, p.slug, p.id, "second");
  expect(a.status).toBe("open");

  const patched = await api(cookie, `/projects/${p.id}/feedback/${b.id}`, {
    method: "PATCH",
    body: { status: "done" },
  });
  expect(patched.status).toBe(200);

  const done = await api(cookie, `/projects/${p.id}/feedback?status=done`);
  expect(done.body.data.items.map((item: any) => item.id)).toEqual([b.id]);
  const open = await api(cookie, `/projects/${p.id}/feedback?status=open`);
  expect(open.body.data.items.map((item: any) => item.id)).toEqual([a.id]);
  expect((await api(cookie, `/projects/${p.id}/feedback?status=nope`)).status).toBe(400);
});

test("dashboard status changes update the GitHub issue", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "push");
  const item = await report(cookie, p.slug, p.id, "push me");
  const n = item.issueNumber;
  const set = (status: string) =>
    api(cookie, `/projects/${p.id}/feedback/${item.id}`, { method: "PATCH", body: { status } });

  expect((await set("in_progress")).body.data).toMatchObject({
    id: item.id,
    status: "in_progress",
  });
  expect(issues.get(n)).toMatchObject({ state: "OPEN", labels: ["bug", "in progress"] });

  await set("wont_fix");
  expect(issues.get(n)).toMatchObject({ state: "CLOSED", stateReason: "NOT_PLANNED" });
  expect(issues.get(n)!.labels).toEqual(["bug"]);

  await set("done");
  expect(issues.get(n)).toMatchObject({ state: "CLOSED", stateReason: "COMPLETED" });

  await set("open");
  expect(issues.get(n)).toMatchObject({ state: "OPEN" });

  calls.length = 0;
  await set("open");
  expect(calls, "an unchanged status makes no GitHub call").toEqual([]);
});

test("a GitHub failure leaves the status unchanged", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "fail");
  const item = await report(cookie, p.slug, p.id, "will fail");
  network.use(
    http.patch("https://api.github.com/repos/:owner/:repo/issues/:n", () =>
      HttpResponse.json({}, { status: 500 }),
    ),
  );
  const res = await api(cookie, `/projects/${p.id}/feedback/${item.id}`, {
    method: "PATCH",
    body: { status: "done" },
  });
  expect(res.status).toBe(503);
  expect(res.body.message ?? res.body.error?.message).toMatch(/GitHub/);
  const after = await api(cookie, `/projects/${p.id}/feedback`);
  expect(after.body.data.items.find((i: any) => i.id === item.id).status).toBe("open");
});

test("feedback whose issue was never filed keeps a local status", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "local");
  network.use(
    http.post("https://api.github.com/repos/:owner/:repo/issues", () =>
      HttpResponse.json({}, { status: 500 }),
    ),
  );
  const item = await report(cookie, p.slug, p.id, "not filed");
  expect(item.state).toBe("issue_error");
  calls.length = 0;
  const res = await api(cookie, `/projects/${p.id}/feedback/${item.id}`, {
    method: "PATCH",
    body: { status: "wont_fix" },
  });
  expect(res.body.data.status).toBe("wont_fix");
  expect(calls).toEqual([]);
});

test("Sync from GitHub pulls issue states in one GraphQL request", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "pull");
  const a = await report(cookie, p.slug, p.id, "a");
  const b = await report(cookie, p.slug, p.id, "b");
  const c = await report(cookie, p.slug, p.id, "c");
  issues.set(a.issueNumber, { state: "CLOSED", stateReason: "COMPLETED", labels: [] });
  issues.set(b.issueNumber, { state: "OPEN", stateReason: null, labels: ["in progress"] });
  issues.delete(c.issueNumber); // deleted on GitHub: left as is

  calls.length = 0;
  const res = await api(cookie, `/projects/${p.id}/sync`, { method: "POST" });
  expect(res.body.data).toEqual({ checked: 3, updated: 2 });
  expect(calls.filter((call) => call.path === "/graphql")).toHaveLength(1);

  const statuses = Object.fromEntries(
    (await api(cookie, `/projects/${p.id}/feedback`)).body.data.items.map((i: any) => [
      i.id,
      i.status,
    ]),
  );
  expect(statuses).toEqual({ [a.id]: "done", [b.id]: "in_progress", [c.id]: "open" });
});

test("the issues webhook refreshes status from GitHub, signed requests only", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "hook");
  const item = await report(cookie, p.slug, p.id, "hooked");
  const payload = {
    action: "closed",
    issue: { number: item.issueNumber },
    repository: { full_name: "Ashik/MyApp" },
  };

  await env.DB.prepare("UPDATE github_apps SET webhook_secret = NULL WHERE id = 1").run();
  expect((await webhook(payload)).status, "no secret: webhooks are off").toBe(404);
  await env.DB.prepare("UPDATE github_apps SET webhook_secret = ? WHERE id = 1")
    .bind(await encryptForTest(SECRET))
    .run();

  expect((await webhook(payload, "issues", "sha256=" + "0".repeat(64))).status).toBe(401);
  expect((await webhook(payload, "issues", await sign("{}"))).status).toBe(401);
  expect((await webhook(payload, "issues", "")).status).toBe(401);
  expect((await webhook({ zen: "hi" }, "ping")).status).toBe(204);

  issues.set(item.issueNumber, { state: "CLOSED", stateReason: "NOT_PLANNED", labels: [] });
  expect((await webhook(payload)).status).toBe(204);
  const after = await api(cookie, `/projects/${p.id}/feedback?status=wont_fix`);
  expect(after.body.data.items.map((i: any) => i.id)).toEqual([item.id]);

  // An issue FeedbackBee did not file: acknowledged without calling GitHub.
  calls.length = 0;
  const other = { ...payload, issue: { number: 99999 } };
  expect((await webhook(other)).status).toBe(204);
  expect(calls).toEqual([]);
});

test("editing text and kind rewrites the issue and swaps the kind label", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "edit");
  const item = await report(cookie, p.slug, p.id, "the buton is broken");
  const n = item.issueNumber;
  calls.length = 0;

  const res = await api(cookie, `/projects/${p.id}/feedback/${item.id}`, {
    method: "PATCH",
    body: { text: "  The button is broken  ", kind: "feature_request" },
  });
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({
    id: item.id,
    text: "The button is broken",
    kind: "feature_request",
    status: "open",
    images: [],
  });

  const patch = calls.find((c) => c.method === "PATCH")!;
  expect(patch.path).toBe(`/repos/ashik/myapp/issues/${n}`);
  expect(patch.body.title).toBe("Feature request: The button is broken");
  expect(patch.body.body).toMatch(/^The button is broken\n/);
  expect(patch.body.body).toContain(`/app/projects/${p.slug}?feedback=${item.id}`);
  expect(patch.body).not.toHaveProperty("state");
  expect(issues.get(n)!.labels).toEqual(["enhancement"]);

  const one = await api(cookie, `/projects/${p.id}/feedback/${item.id}`);
  expect(one.status).toBe(200);
  expect(one.body.data).toMatchObject({ text: "The button is broken", kind: "feature_request" });

  calls.length = 0;
  const same = await api(cookie, `/projects/${p.id}/feedback/${item.id}`, {
    method: "PATCH",
    body: { text: "The button is broken" },
  });
  expect(same.status).toBe(200);
  expect(calls, "an unchanged edit makes no GitHub call").toEqual([]);
});

test("edits are validated, and a GitHub failure leaves the text unchanged", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "editbad");
  const item = await report(cookie, p.slug, p.id, "original");
  const patch = (body: unknown) =>
    api(cookie, `/projects/${p.id}/feedback/${item.id}`, { method: "PATCH", body });

  expect((await patch({})).status).toBe(400);
  expect((await patch({ text: "   " })).status).toBe(400);
  expect((await patch({ kind: "rant" })).status).toBe(400);
  expect((await patch({ text: "x".repeat(5001) })).status).toBe(400);

  network.use(
    http.patch("https://api.github.com/repos/:owner/:repo/issues/:n", () =>
      HttpResponse.json({}, { status: 500 }),
    ),
  );
  expect((await patch({ text: "changed" })).status).toBe(503);
  const after = await api(cookie, `/projects/${p.id}/feedback/${item.id}`);
  expect(after.body.data.text).toBe("original");
});

test("a report deletes from FeedbackBee only; its issue stays", async () => {
  const cookie = await login();
  const p = await createProject(cookie, "del");
  const other = await createProject(cookie, "delother");
  const item = await report(cookie, p.slug, p.id, "delete me");
  calls.length = 0;

  const wrongProject = await api(cookie, `/projects/${other.id}/feedback/${item.id}`, {
    method: "DELETE",
  });
  expect(wrongProject.status).toBe(404);

  const res = await api(cookie, `/projects/${p.id}/feedback/${item.id}`, { method: "DELETE" });
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ id: item.id });
  expect(calls, "deleting never touches GitHub").toEqual([]);
  expect(issues.get(item.issueNumber)!.state).toBe("OPEN");

  expect((await api(cookie, `/projects/${p.id}/feedback/${item.id}`)).status).toBe(404);
  const list = await api(cookie, `/projects/${p.id}/feedback`);
  expect(list.body.data.items).toEqual([]);
  const images = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM feedback_images WHERE feedback_id = ?",
  )
    .bind(item.id)
    .first<{ n: number }>();
  expect(images?.n).toBe(0);
});
