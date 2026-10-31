import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { normalizeOrigin, originAllowed } from "../../apps/web/src/server/lib/origins";
import { ghCalls, network, stubGithub } from "./gh-server";
import { api, createProject, latestFeedback, login, submit } from "./helpers";

// A project's allowed origins: which websites may post to POST /api/v1/feedback.

describe("normalizeOrigin", () => {
  test.each([
    ["https://Shop.Example.com/", "https://shop.example.com"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["https://example.com:443", "https://example.com"],
    ["https://*.example.com", "https://*.example.com"],
  ])("%s → %s", (entry, expected) => {
    expect(normalizeOrigin(entry)).toBe(expected);
  });

  test.each([
    "example.com",
    "ftp://example.com",
    "https://example.com/path",
    "https://example.com?q=1",
    "https://user:pw@example.com",
    "https://*.com",
    "*",
  ])("rejects %s", (entry) => {
    expect(normalizeOrigin(entry)).toBeNull();
  });
});

describe("originAllowed", () => {
  const allowed = ["https://shop.example.com", "https://*.acme.dev", "http://localhost:3000"];
  test.each([
    ["https://shop.example.com", true],
    ["https://SHOP.example.com", true],
    ["https://app.acme.dev", true],
    ["https://a.b.acme.dev", true],
    ["https://acme.dev", false], // the wildcard covers subdomains only
    ["http://app.acme.dev", false], // scheme must match
    ["https://evil.com", false],
    ["https://shop.example.com.evil.com", false],
    ["https://evilacme.dev", false],
    ["http://localhost:3000", true],
    ["http://localhost:5173", false],
    ["null", false], // sandboxed iframes, file://
  ])("%s → %s", (origin, expected) => {
    expect(originAllowed(origin, allowed)).toBe(expected);
  });
});

describe("POST /api/v1/feedback with allowed origins", () => {
  const ok = () =>
    stubGithub(() => ({
      status: 201,
      json: { number: 7, html_url: "https://github.com/a/b/issues/7" },
    }));
  beforeAll(() => {
    network.enable();
    ok();
  });
  afterEach(() => {
    network.resetHandlers();
    ok();
  });
  afterAll(() => network.disable());

  async function guarded() {
    const cookie = await login();
    const project = await createProject(cookie, "guarded");
    const res = await api(cookie, `/projects/${project.id}`, {
      method: "PATCH",
      body: { allowedOrigins: ["https://shop.example.com/", "https://*.acme.dev", ""] },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.allowedOrigins).toEqual([
      "https://shop.example.com",
      "https://*.acme.dev",
    ]);
    return { cookie, project };
  }

  test("an allowed site, and a native app with no Origin, are accepted", async () => {
    const { cookie, project } = await guarded();
    const fromSite = await submit(
      { project: project.slug, kind: "issue", text: "from the shop" },
      { Origin: "https://shop.example.com" },
    );
    expect(fromSite.status).toBe(201);
    const fromSubdomain = await submit(
      { project: project.slug, kind: "issue", text: "from a subdomain" },
      { Origin: "https://app.acme.dev" },
    );
    expect(fromSubdomain.status).toBe(201);
    const fromApp = await submit({ project: project.slug, kind: "issue", text: "from android" });
    expect(fromApp.status).toBe(201);
    expect((await latestFeedback(cookie, project.id)).text).toBe("from android");
  });

  test("another site is refused with 403 before anything is stored or filed", async () => {
    const { cookie, project } = await guarded();
    const before = ghCalls.length;
    const res = await submit(
      { project: project.slug, kind: "issue", text: "from elsewhere" },
      { Origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({
      code: "ORIGIN_NOT_ALLOWED",
      message: "this site is not allowed to send feedback to this project",
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(ghCalls.length).toBe(before);
    const { body } = await api(cookie, `/projects/${project.id}/feedback`);
    expect(body.data.items).toHaveLength(0);
  });

  test("an empty list accepts any site, as before", async () => {
    const cookie = await login();
    const project = await createProject(cookie, "open");
    expect((await api(cookie, `/projects/${project.id}`)).body.data.allowedOrigins).toEqual([]);
    const res = await submit(
      { project: project.slug, kind: "other", text: "anywhere" },
      { Origin: "https://anything.example" },
    );
    expect(res.status).toBe(201);
  });

  test("an entry that is not an origin is a 400 naming it", async () => {
    const cookie = await login();
    const project = await createProject(cookie, "badorigin");
    const res = await api(cookie, `/projects/${project.id}`, {
      method: "PATCH",
      body: { allowedOrigins: ["https://ok.example", "shop.example.com/path"] },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain(
      '\\"shop.example.com/path\\" is not an origin',
    );
  });
});
