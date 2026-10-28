// Demo host page served by the worker so /demo exercises the widget against any deployment.
import { Hono } from "hono";
import type { Env } from "../types.ts";
import { insertProject, projectBySlug } from "../db/queries.ts";

const DEMO_SLUG = "demo";
const DEMO_REPO = "octocat/hello-world";

async function ensureDemoProject(db: D1Database) {
  const existing = await projectBySlug(db, DEMO_SLUG);
  if (existing) return existing;
  try {
    return await insertProject(db, {
      name: "FeedbackBee demo",
      slug: DEMO_SLUG,
      github_repo: DEMO_REPO,
      labels_map: JSON.stringify({ issue: "bug", feature_request: "enhancement", other: "feedback" }),
    });
  } catch {
    // Slug is UNIQUE; a concurrent request seeded it first. Reuse that row.
    return projectBySlug(db, DEMO_SLUG);
  }
}

const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FeedbackBee demo</title>
<style>
body { font: 16px/1.6 -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #111; }
.box { background: #eef2ff; border-radius: 12px; padding: 24px; margin: 20px 0; }
button.big { font-size: 18px; padding: 12px 20px; border-radius: 10px; border: none; background: #1a1a2e; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<h1>Demo shop</h1>
<p>This page hosts the FeedbackBee widget. Click the pill in the corner to send feedback.</p>
<div class="box">
<h2>Checkout total</h2>
<p id="total">$42.00</p>
<button class="big" onclick="document.getElementById('total').textContent='NaN'">Apply discount</button>
<p>Something for bug hunters to report.</p>
</div>
<script src="/embed.js" data-project="demo" async></script>
</body>
</html>`;

export const demoRoutes = new Hono<{ Bindings: Env }>();

demoRoutes.get("/demo", async (c) => {
  await ensureDemoProject(c.env.DB);
  return c.html(DEMO_HTML);
});
