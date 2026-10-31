// Static routing in the Worker's catch-all (worker/static-assets.ts), with a
// stand-in ASSETS binding that behaves like the real one: an ETag on every
// file, 304 for a matching If-None-Match. Same cases as 404less's suite.
import { createExecutionContext, env } from "cloudflare:test";
import { expect, test } from "vitest";
import worker from "../../apps/web/src/server/entry.worker";

const FILES: Record<string, string> = {
  "/app.html": '<div id="root"></div>',
  "/index.html": "home",
  "/404.html": "not here",
};
const etag = (p: string) => `"${p}"`;
const ASSETS = {
  fetch: async (req: Request) => {
    const path = new URL(req.url).pathname;
    if (!(path in FILES)) return new Response("nf", { status: 404 });
    if (req.headers.get("If-None-Match") === etag(path)) {
      return new Response(null, { status: 304, headers: { ETag: etag(path) } });
    }
    return new Response(FILES[path], {
      headers: { ETag: etag(path), "Content-Type": "text/html" },
    });
  },
};

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await worker.fetch(
    new Request(`http://localhost${path}`, { headers, redirect: "manual" }) as never,
    { ...env, ASSETS } as never,
    createExecutionContext() as never,
  );
  return { status: res.status, body: await res.text(), location: res.headers.get("location") };
}

test("the website owns / and dashboard routes serve the SPA shell", async () => {
  expect(await get("/")).toMatchObject({ status: 200, body: "home" });
  for (const path of ["/app", "/app/login", "/app/projects/shop?feedback=1"]) {
    expect(await get(path)).toMatchObject({ status: 200, body: FILES["/app.html"] });
  }
});

test("a revisit with a cached shell or page gets 304, never an empty 200", async () => {
  expect((await get("/app/projects", { "If-None-Match": etag("/app.html") })).status).toBe(304);
  expect((await get("/", { "If-None-Match": etag("/index.html") })).status).toBe(304);
});

test("unknown pages get the site's 404 page with a 404 status, even when cached", async () => {
  expect(await get("/missing")).toMatchObject({ status: 404, body: "not here" });
  expect(await get("/missing", { "If-None-Match": etag("/404.html") })).toMatchObject({
    status: 404,
    body: "not here",
  });
});

test("old dashboard URLs (in filed GitHub issues) redirect under /app", async () => {
  expect(await get("/projects/shop?feedback=abc")).toMatchObject({
    status: 301,
    location: "/app/projects/shop?feedback=abc",
  });
  expect((await get("/login")).location).toBe("/app/login");
  expect((await get("/settings")).location).toBe("/app/settings");
});

test("a trailing slash on a page redirects to the page", async () => {
  expect(await get("/self-host/")).toMatchObject({ status: 301, location: "/self-host" });
});

test("API, widget and demo routes are untouched by the catch-all", async () => {
  expect((await get("/health")).status).toBe(200);
  expect((await get("/embed.js")).body).toContain("FeedbackBee");
  const unauthenticated = await get("/api/v1/nope");
  expect(unauthenticated.status).toBe(401);
  expect(JSON.parse(unauthenticated.body).success).toBe(false);
  const unknown = await get("/api/nope");
  expect(unknown.status).toBe(404);
  expect(JSON.parse(unknown.body).success).toBe(false);
  expect((await get("/demo")).body).toContain("Demo shop");
});
