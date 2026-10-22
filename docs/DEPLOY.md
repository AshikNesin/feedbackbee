# Deploying FeedbackBarn

One Cloudflare account, three commands. Everything fits the free tier.

## 1. Create resources

```bash
npx wrangler d1 create feedbackbarn
npx wrangler r2 bucket create feedbackbarn-media
```

Paste the printed `database_id` into `wrangler.jsonc` (the `REPLACE_WITH_D1_ID` slot).

## 2. Set the secret

```bash
npx wrangler secret put APP_SECRET     # paste output of: openssl rand -hex 32
```

`APP_SECRET` encrypts GitHub PATs at rest and hashes the owner password. Rotating
it invalidates stored PATs (re-enter them per project) but not the password.

## 3. Deploy

```bash
npm install
npm run deploy        # builds the SPA, applies D1 migrations, deploys the worker
```

## 4. First login

Open the deployed URL. The first email/password you submit creates the owner
account. There is exactly one owner in v1.

## 5. Wire a project

Create a project with slug, `owner/repo`, and a PAT that has issue write on that
repo. Copy the snippet into your app, or point the Android SDK at
`https://your-worker.workers.dev`.

## Updating

`git pull && npm run deploy`. Migrations apply automatically.

## Self-check after deploy

- `GET /api/health` returns `{"ok":true}`.
- `GET /demo` renders the demo shop with the widget pill.
- Send one feedback from `/demo` and watch the issue appear in the repo.

## Free-tier ceilings

| Resource | Free limit | FeedbackBarn pressure |
|---|---|---|
| Workers | 100k req/day | Widget + API + media reads |
| D1 | 5M rows read/day | Rate-limit rows dominate; prune monthly |
| R2 | 10 GB stored | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |

Prune old media with `npx wrangler r2 object delete` (script lands when a
self-hoster actually needs it).
