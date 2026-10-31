import { Hono } from "hono";
import type { AppEnv } from "@groot/core/types";
import { ensureDemoProject } from "../projects/projects.service";

/**
 * `/demo`: a host page for the widget, served by the Worker so any deployment
 * can be tried end to end. It posts to the `demo` project (repo
 * octocat/hello-world), created on the first visit; edit it in the dashboard
 * to file issues somewhere real.
 */
const router = new Hono<AppEnv>();

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
.row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
button.ghost { font-size: 15px; padding: 10px 16px; border-radius: 10px; border: 1px solid #c7d2fe; background: #fff; color: #1a1a2e; cursor: pointer; }
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
<div class="box">
<h2>Headless</h2>
<p>Same widget, opened from your own UI via the JS API.</p>
<div class="row">
<button class="ghost" data-feedbackbee-open data-feedbackbee-kind="issue" data-feedbackbee-lock-kind>Report a bug</button>
<button class="ghost" data-feedbackbee-open data-feedbackbee-kind="feature_request">Request a feature</button>
<button class="ghost" id="bee-identified">Identified user</button>
</div>
<script>
document.getElementById('bee-identified').addEventListener('click', function () {
  if (!window.FeedbackBee) return; // embed.js still loading
  FeedbackBee.identify({ email: 'jane@acme.com', name: 'Jane Doe', id: 'u_123' });
  FeedbackBee.setContext({ plan: 'pro', workspace: 'ws_42' });
  FeedbackBee.open().then(function (r) {
    if (r.status === 'submitted') console.log('feedbackbee sent', r.id);
  }, function () {});
});
</script>
</div>
<script src="/embed.js" data-project="demo" async></script>
</body>
</html>`;

router.get("/demo", async (c) => {
  await ensureDemoProject();
  return c.html(DEMO_HTML);
});

export default router;
