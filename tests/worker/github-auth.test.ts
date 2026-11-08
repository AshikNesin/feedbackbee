import { SELF } from "cloudflare:test";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { ghAuthCalls, ghCalls, network, stubGithub, stubGithubApp } from "./gh-server";
import { api, createProject, ensureGithubApp, latestFeedback, login, submit } from "./helpers";

beforeAll(() => network.enable());
beforeEach(() => {
  network.resetHandlers();
  stubGithubApp();
  stubGithub(() => ({
    status: 201,
    json: { number: 42, html_url: "https://github.com/ashik/myapp/issues/42" },
  }));
  ghAuthCalls.length = 0;
  ghCalls.length = 0;
});
afterAll(() => network.disable());

test("project creation rejects repositories outside the app installation", async () => {
  const cookie = await login();
  await ensureGithubApp();
  network.use(
    http.get("https://api.github.com/repos/other/forbidden/installation", () =>
      HttpResponse.json({ message: "private upstream details" }, { status: 404 }),
    ),
  );
  const result = await api(cookie, "/projects", {
    method: "POST",
    body: { name: "Forbidden", slug: "forbidden", githubRepo: "other/forbidden" },
  });
  expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain("private upstream details");
  expect(ghCalls).toHaveLength(0);
});

test("revoked installation access retains the report and does not send an issue", async () => {
  const cookie = await login();
  const project = await createProject(cookie, "revoked");
  network.use(
    http.get("https://api.github.com/repos/ashik/myapp/installation", () =>
      HttpResponse.json({ message: "Not Found" }, { status: 404 }),
    ),
  );
  const result = await submit({ project: project.slug, kind: "issue", text: "Keep this report" });
  expect(result.status).toBe(202);
  expect(result.body.data.state).toBe("issue_error");
  expect((await latestFeedback(cookie, project.id)).text).toBe("Keep this report");
  expect(ghCalls).toHaveLength(0);
});

test("issue writes use a repository-scoped token and renew once after 401", async () => {
  const project = await createProject(await login(), "renew");
  let attempts = 0;
  stubGithub(() =>
    ++attempts === 1
      ? { status: 401, json: { message: "Bad credentials" } }
      : { status: 201, json: { number: 43, html_url: "https://github.com/ashik/myapp/issues/43" } },
  );
  const result = await submit({
    project: project.slug,
    kind: "issue",
    text: "Renew installation token",
  });
  expect(result.status).toBe(201);
  expect(attempts).toBe(2);
  const tokenRequests = ghAuthCalls.filter((call) => call.path.endsWith("/access_tokens"));
  expect(
    tokenRequests.some(
      (call) =>
        JSON.stringify(call.body) ===
        JSON.stringify({ permissions: { issues: "write" }, repository_ids: [902] }),
    ),
  ).toBe(true);
  const jwt = tokenRequests.at(-1)!.auth!.slice("Bearer ".length);
  const payload = JSON.parse(atob(jwt.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/")));
  expect(payload.iss).toBe("321");
  expect(payload.exp - payload.iat).toBeLessThanOrEqual(600);
  expect(ghCalls.at(-1)?.auth).toBe("Bearer test-installation-token");
});

test("an upstream redirect is not followed with app credentials", async () => {
  const project = await createProject(await login(), "redirect");
  network.use(
    http.get(
      "https://api.github.com/repos/ashik/myapp/installation",
      () =>
        new HttpResponse(null, {
          status: 302,
          headers: { location: "https://not-github.example/collect" },
        }),
    ),
  );
  let forwarded = false;
  network.use(
    http.get("https://not-github.example/collect", () => {
      forwarded = true;
      return HttpResponse.json({});
    }),
  );
  const result = await submit({
    project: project.slug,
    kind: "issue",
    text: "Do not forward credentials",
  });
  expect(result.status).toBe(202);
  expect(result.body.data.error).toContain("GitHub 302");
  expect(forwarded).toBe(false);
});

test("foreign origins cannot read installed repository names", async () => {
  const cookie = await login();
  const response = await SELF.fetch("https://example.com/api/v1/github/repositories", {
    headers: { cookie, origin: "https://sibling.example.com" },
  });
  expect(response.status).toBe(403);
});
