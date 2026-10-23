// Session replay viewer for web recordings (rrweb events, gzipped JSON in R2).
import { Hono } from "hono";
import type { Env } from "../types.ts";
import { isReplayKey } from "../lib/validate.ts";
import { PLAYER_CSS, PLAYER_JS } from "../generated/player_js.ts";

// Recorded DOM is untrusted. The player renders it in a script-less sandboxed
// iframe; the CSP also forbids any script but our own and any network call but
// same-origin, while letting the recorded page's images, fonts and styles load.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https: http: data:",
  "img-src * data: blob:",
  "font-src * data:",
  "media-src * data: blob:",
  "connect-src 'self'",
  "frame-src 'self' about: blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Session replay · FeedbackBee</title>
<style>${PLAYER_CSS}
body { margin: 0; min-height: 100vh; background: #f4f4f5; color: #18181b; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; }
header { width: 100%; max-width: 1240px; box-sizing: border-box; padding: 20px 20px 12px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.2px; }
#meta { color: #71717a; font-size: 13px; overflow-wrap: anywhere; }
#app { padding: 0 20px 24px; }
#status { color: #71717a; padding: 40px 0; }
.rr-player { box-shadow: 0 0 0 1px #e4e4e7, 0 12px 40px #0000001a !important; border-radius: 12px; overflow: hidden; }
</style>
</head>
<body>
<header><h1>Session replay</h1><span id="meta"></span></header>
<main id="app"><p id="status">Loading replay…</p></main>
<script src="/replay-player.js"></script>
</body>
</html>`;

// Appended to the player bundle so the page needs no inline script.
const BOOT = `
(function () {
  var status = document.getElementById("status");
  if (!status) return;
  var key = location.pathname.replace(/^\\/replay\\//, "");
  fetch("/f/" + key)
    .then(function (r) {
      if (!r.ok) throw new Error("missing");
      return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).json();
    })
    .then(function (data) {
      var events = Array.isArray(data) ? data : data.events;
      if (!events || events.length < 2) throw new Error("empty");
      var vw = (data.viewport && data.viewport.w) || 1280, vh = (data.viewport && data.viewport.h) || 800;
      var scale = Math.min(1, (Math.min(innerWidth, 1240) - 40) / vw, (innerHeight - 160) / vh);
      var secs = Math.round((events[events.length - 1].timestamp - events[0].timestamp) / 1000);
      var meta = document.getElementById("meta");
      meta.textContent = (data.url ? data.url + " · " : "") + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
      status.remove();
      var Player = rrwebPlayer.default || rrwebPlayer;
      new Player({
        target: document.getElementById("app"),
        props: {
          events: events,
          width: Math.round(vw * scale),
          height: Math.round(vh * scale),
          autoPlay: true,
          skipInactive: true,
          showController: true,
          // The widget's own nodes were blocked while recording; hide their placeholders.
          insertStyleRules: [".fbx{display:none!important}"],
        },
      });
    })
    .catch(function () { status.textContent = "This replay couldn\\u2019t be loaded."; });
})();
`;

export const replayRoutes = new Hono<{ Bindings: Env }>();

replayRoutes.get("/replay-player.js", (c) =>
  c.text(PLAYER_JS + BOOT, 200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  }),
);

replayRoutes.get("/replay/*", (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/replay\//, ""));
  if (!key.startsWith("p/") || !isReplayKey(key)) return c.text("not found", 404);
  return c.html(PAGE, 200, { "content-security-policy": CSP, "referrer-policy": "no-referrer" });
});
