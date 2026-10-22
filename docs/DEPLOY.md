# Deploying FeedbackBee

## One click (recommended)

Click the Deploy to Cloudflare button in the README. Cloudflare clones the repo into your GitHub, provisions a D1 database and R2 bucket, installs, builds (`npm run build`), applies migrations (`npm run deploy`), and deploys. After it deploys, set the GitHub token once, step 1 below.

Open the deployed URL. The first email/password you submit creates the owner account.

Then:

1. Create a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) with Issues: Read and Write on all your repos, then `npx wrangler secret put GITHUB_TOKEN`.
2. Create a project (slug, `owner/repo`). No token per project.
3. Copy the embed snippet into your app, or point the Android SDK at the deploy URL.

## Manual deploy

```bash
npx wrangler d1 create feedbackbee      # optional: pin the id in wrangler.jsonc
npx wrangler r2 bucket create feedbackbee-media
npm install && npm --prefix web install
npx wrangler secret put GITHUB_TOKEN    # fine-grained PAT, Issues: Read and Write
npm run deploy
```

## Self-check after deploy

- `GET /api/health` returns `{"ok":true}`.
- In the dashboard, create a project with slug `demo` (any repo). `/demo` hardcodes that slug.
- `GET /demo` renders the demo shop with the widget pill.
- Send one feedback from `/demo` and watch the issue appear in the repo.

## GITHUB_TOKEN

One token for the whole deployment, held as a Worker secret. Every project's issue is created with it, so its repo access list defines what projects can point at. Rotate it with `npx wrangler secret put GITHUB_TOKEN`. Projects never store tokens.

## Free-tier ceilings

| Resource | Free limit | FeedbackBee pressure |
|---|---|---|
| Workers | 100k req/day | Widget + API + media reads |
| D1 | 5M rows read/day | Rate-limit rows dominate; prune monthly |
| R2 | 10 GB stored | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |
