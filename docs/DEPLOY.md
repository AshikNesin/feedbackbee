# Deploying FeedbackBee

## One click (recommended)

Click the Deploy to Cloudflare button in the README. Cloudflare clones the repo into your GitHub, provisions a D1 database and R2 bucket, installs, builds (`npm run build`), applies migrations (`npm run deploy`), and deploys. No secrets to configure: the app generates its own encryption secret on first run and stores it in D1.

Open the deployed URL. The first email/password you submit creates the owner account.

Then:

1. Create a project (slug, `owner/repo`, a GitHub PAT with issue write).
2. Copy the embed snippet into your app, or point the Android SDK at the deploy URL.

## Manual deploy

```bash
npx wrangler d1 create feedbackbee      # optional: pin the id in wrangler.jsonc
npx wrangler r2 bucket create feedbackbee-media
npm install && npm --prefix web install
npx wrangler secret put APP_SECRET      # optional; D1-stored secret is generated otherwise
npm run deploy
```

## Self-check after deploy

- `GET /api/health` returns `{"ok":true}`.
- In the dashboard, create a project with slug `demo` (any repo + PAT). `/demo` hardcodes that slug.
- `GET /demo` renders the demo shop with the widget pill.
- Send one feedback from `/demo` and watch the issue appear in the repo.

## APP_SECRET

The env var, when set (16+ chars), overrides the D1-stored secret. Rotating either invalidates stored PATs (re-enter them per project) but not the owner password.

## Free-tier ceilings

| Resource | Free limit | FeedbackBee pressure |
|---|---|---|
| Workers | 100k req/day | Widget + API + media reads |
| D1 | 5M rows read/day | Rate-limit rows dominate; prune monthly |
| R2 | 10 GB stored | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |
