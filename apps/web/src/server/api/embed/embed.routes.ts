import { Hono } from "hono";
import type { AppContext, AppEnv } from "@groot/core/types";
import { CAPTURE_JS } from "../../generated/capture_js";
import { EMBED_JS } from "../../generated/embed_js";
import { RECORD_JS } from "../../generated/record_js";

/**
 * The browser scripts customer pages load. `embed/widget.js` is the widget;
 * the other two are vendored libraries it lazy-loads. All are generated into
 * `generated/` by `pnpm build:embed`.
 */
const router = new Hono<AppEnv>();

function script(body: string, cacheControl: string) {
  return (c: AppContext) =>
    c.body(body, 200, {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": cacheControl,
    });
}

// The widget changes with deploys: short cache, served stale while revalidating.
router.get("/embed.js", script(EMBED_JS, "public, max-age=300, stale-while-revalidate=86400"));
// DOM-to-image library, loaded on the first screenshot.
router.get(
  "/embed-capture.js",
  script(CAPTURE_JS, "public, max-age=86400, stale-while-revalidate=604800"),
);
// rrweb recorder, loaded when someone records the page.
router.get(
  "/embed-record.js",
  script(RECORD_JS, "public, max-age=86400, stale-while-revalidate=604800"),
);

export default router;
