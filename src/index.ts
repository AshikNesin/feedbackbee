import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.ts";
import { feedbackRoutes } from "./routes/feedback.ts";
import { mediaRoutes } from "./routes/media.ts";
import { authRoutes } from "./routes/auth.ts";
import { apiRoutes } from "./routes/api.ts";
import { demoRoutes } from "./routes/demo.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/embed.js", (c) =>
  c.text(EMBED_JS, 200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "public, max-age=300, stale-while-revalidate=86400",
  }),
);
app.route("/", feedbackRoutes);
app.route("/", mediaRoutes);
app.route("/", authRoutes);
app.route("/", apiRoutes);
app.route("/", demoRoutes);

export default app;

import { EMBED_JS } from "./embed_js.ts";
