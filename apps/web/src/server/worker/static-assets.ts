// Static assets with explicit routing (html_handling is off in wrangler.jsonc):
//   /app, /app/*  → the dashboard SPA shell (app.html), client-side routed
//   /foo          → foo.html from the website (site/), else the site's 404 page
// The same layout as 404less. Workers only: reads the ASSETS binding per
// request; without one (Node) it falls through. Mounted last (app.ts).
import { Hono } from "hono";
import type { AppEnv } from "@groot/core/types";

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

/** Dashboard paths from before the /app move; links to them sit in filed GitHub issues. */
const LEGACY_DASHBOARD = /^\/(projects(\/.*)?|settings|login)$/;

export const staticAssets = new Hono<AppEnv>();

staticAssets.get("*", async (c, next) => {
  const assets = c.env?.ASSETS as AssetsBinding | undefined;
  // no ASSETS binding (Node): fall through to the runtime's own static serving / 404.
  // Unknown API paths stay JSON errors, never the website's 404 page.
  if (!assets || c.req.path.startsWith("/api/")) {
    await next();
    return;
  }
  const url = new URL(c.req.url);
  const fetchAsset = (p: string) =>
    assets.fetch(new Request(new URL(p, url.origin), { headers: c.req.raw.headers }));

  if (LEGACY_DASHBOARD.test(url.pathname)) {
    return c.redirect(`/app${url.pathname}${url.search}`, 301);
  }
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    const res = await fetchAsset("/app.html");
    // 304 (If-None-Match): the browser's cached copy is app.html already; rewrapping it as 200 would serve an empty page
    if (res.status === 304) return res;
    return new Response(res.body, { status: 200, headers: res.headers });
  }
  // trailing slash on a website page (/foo/ → /foo)
  if (/^\/[a-z0-9-]+\/$/.test(url.pathname)) {
    return c.redirect(url.pathname.slice(0, -1) + url.search, 301);
  }
  // website pages: / → index.html, /foo → foo.html; anything else → 404.html
  const page =
    url.pathname === "/"
      ? "/index.html"
      : /^\/[a-z0-9-]+$/.test(url.pathname)
        ? `${url.pathname}.html`
        : null;
  if (page) {
    const res = await fetchAsset(page);
    if (res.ok || res.status === 304) return res;
  }
  // no conditional headers: a 304 can't carry the 404 status, and its empty body would replace the page
  const nf = await assets.fetch(new Request(new URL("/404.html", url.origin)));
  return new Response(nf.body, { status: 404, headers: nf.headers });
});
