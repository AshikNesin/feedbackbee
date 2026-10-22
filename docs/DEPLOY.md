# Deploying FeedbackBee

The Deploy to Cloudflare button only works for public repos, because Cloudflare copies the repo into the deployer's GitHub account. For a private repo, use Workers Builds or deploy from your machine.

## One-time setup

Run these from the repo root. You need Node 22 or newer and pnpm 11 (`package.json` pins 11.18.0).

```bash
pnpm install
pnpm --dir web install
pnpm exec wrangler login
pnpm exec wrangler d1 create feedbackbee        # copy the database_id it prints
pnpm exec wrangler r2 bucket create feedbackbee-media
pnpm exec wrangler secret put GITHUB_TOKEN      # fine-grained PAT, Issues: Read and Write
```

Paste the `database_id` into the `DB` binding in `wrangler.jsonc`:

```jsonc
{ "binding": "DB", "database_name": "feedbackbee", "database_id": "<your id>", "migrations_dir": "migrations" }
```

Keep `database_id` pinned to the database in your account so the remote migration step targets it directly. When deploying to a different account, replace it with that account's database id.

## Option A: deploy from your machine

```bash
pnpm run deploy
```

This builds the dashboard, applies D1 migrations to your account, and deploys the Worker. Run it again after each update.

## Option B: deploy from Cloudflare on each push

Use this when you want Cloudflare to build and deploy from GitHub, including for a private repo.

1. In the Cloudflare dashboard, open Workers & Pages. If you already deployed with Option A, open the `feedbackbee` Worker, go to Settings, then Builds, and select Connect. Otherwise, select Create application and import the repo.
2. Select the private repo and the `main` branch. If prompted, authorize the Cloudflare GitHub app and give it access to this repo.
3. Set the build command to `pnpm run build` and the deploy command to `pnpm run deploy`.
4. Save. Each push to `main` now builds and deploys. To rebuild without a new commit, retry a past build from the build history at the bottom of the Deployments tab.

Two things to check on the first build:

- **API token.** Cloudflare's default build token covers Workers, KV, and R2, but not D1. The `deploy` script runs remote migrations, so it can fail with the default token. Either create a user API token with D1 Edit, Workers Scripts Edit, and R2 Edit, and select it under Settings, then Builds, then API token. Or run migrations yourself with `pnpm exec wrangler d1 migrations apply DB --remote`, and set the deploy command to `pnpm exec wrangler deploy`.
- **Package manager.** Check the build log to confirm the build image runs pnpm. The Cloudflare docs I checked don't list the installed package managers.

## Self-check after deploy

- `GET /api/health` returns `{"ok":true}`.
- Open the deployed URL and sign up first. The first email and password you submit create the owner account, so do this before anyone else sees the URL.
- Visit `/demo`. It provisions a `demo` project (repo `octocat/hello-world`) automatically; edit it in the dashboard if you want issues elsewhere.
- Send one feedback from `/demo` and check that the issue appears in the repo.

## GITHUB_TOKEN

One token for the whole deployment, held as a Worker secret. Every project's issue is created with it, so its repo access list defines what projects can point at. Rotate it with `pnpm exec wrangler secret put GITHUB_TOKEN`. Projects never store tokens.

## Free-tier ceilings

| Resource | Free limit | FeedbackBee pressure |
|---|---|---|
| Workers | 100k req/day | Widget + API + media reads |
| D1 | 5M rows read/day | Rate-limit rows dominate; prune monthly |
| R2 | 10 GB stored | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |
