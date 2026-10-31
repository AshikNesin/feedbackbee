# Deploying FeedbackBee

FeedbackBee runs on Cloudflare Workers: D1 for data, R2 for attachments, Static
Assets for the dashboard. Everything fits the Workers Free plan.

The Deploy to Cloudflare button only works for public repos, because Cloudflare
copies the repo into the deployer's GitHub account. For a private repo, use
Workers Builds or deploy from your machine.

## One-time setup

You need Node 24 and pnpm 10 (`package.json` pins the version). From the repo root:

```bash
pnpm install
pnpm exec wrangler login
pnpm deploy:worker                              # builds the dashboard, deploys the Worker
pnpm exec wrangler secret put GITHUB_TOKEN      # fine-grained PAT, Issues: Read and Write
```

You don't create the database or the bucket, and `wrangler.jsonc` holds no
account ids: on the first deploy wrangler creates the D1 database
(`feedbackbee`) and the R2 bucket (`feedbackbee-media`) in your account, and
reuses them on every deploy after. Wrangler offers to write the new ids into
`wrangler.jsonc`; you can discard that change, deploys keep working without it.

`GITHUB_TOKEN` is the only secret. Database migrations apply on the Worker's
first request (`apps/web/src/server/worker/boot.ts`), so there is no separate
migrate step. groot's production secrets (`JWT_SECRET_KEY`, `ADMIN_AUTH_KEY`)
are generated on first boot and kept in D1, and `ORIGIN` / `RP_ID` (used by
passkeys) default to the host of the first request. Set any of them yourself
(`wrangler secret put`, or `vars` in `wrangler.jsonc`) to override, for example
when the Worker serves several hostnames.

## Option A: deploy from your machine

```bash
pnpm deploy:worker
```

Run it again after each update.

## Option B: deploy from Cloudflare on each push

1. In the Cloudflare dashboard, open Workers & Pages. If you already deployed
   with Option A, open the `feedbackbee` Worker, go to Settings, then Builds, and
   select Connect. Otherwise, select Create application and import the repo.
2. Select the repo and the `main` branch.
3. Set the build command to `pnpm build:client` and the deploy command to
   `pnpm exec wrangler deploy`.
4. Save. Each push to `main` now builds and deploys.

Migrations run inside the Worker, not from the build. If the first build
cannot create the D1 database or the R2 bucket with the default build token,
select a user API token with D1 Edit, R2 Edit and Workers Scripts Edit under
Settings, then Builds, then API token.

## Self-check after deploy

- `GET /health` returns `{"status":"ok",...}`.
- Open `/app` on the deployed URL and sign in first (`/` is the FeedbackBee website). **The first email and password you
  submit create the owner account**, so do this before anyone else sees the URL.
  After that, sign-in only accepts existing accounts. You can add a passkey under
  Settings, then Security.
- Visit `/demo`. It provisions a `demo` project (repo `octocat/hello-world`)
  automatically; edit it in the dashboard if you want issues elsewhere.
- Send one report from `/demo` and check that the issue appears in the repo.

## GITHUB_TOKEN

One token for the whole deployment, held as a Worker secret. Every project's
issue is created with it, so its repo access list defines what projects can
point at. Rotate it with `pnpm exec wrangler secret put GITHUB_TOKEN`. Projects
never store tokens, and the token never appears in an API response.

## Free-tier ceilings

| Resource | Free limit       | FeedbackBee pressure                                           |
| -------- | ---------------- | -------------------------------------------------------------- |
| Workers  | 100k req/day     | Widget + API + media reads                                     |
| D1       | 5M rows read/day | Rate-limit rows dominate; prune monthly                        |
| R2       | 10 GB stored     | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |
