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
openssl rand -base64 32 | pnpm exec wrangler secret put FEEDBACKBEE_ENCRYPTION_KEY
```

You don't create the database or the bucket, and `wrangler.jsonc` holds no
account ids: on the first deploy wrangler creates the D1 database
(`feedbackbee`) and the R2 bucket (`feedbackbee-media`) in your account, and
reuses them on every deploy after. Wrangler offers to write the new ids into
`wrangler.jsonc`; you can discard that change, deploys keep working without it.

`FEEDBACKBEE_ENCRYPTION_KEY` is required before registering or using the GitHub App.
It must be a random base64-encoded 32-byte key; keep it as a Worker secret,
outside D1 and all D1 backups. D1 stores the GitHub App private key encrypted
with this secret. Losing the secret makes that connection unusable; you must
disconnect and register the app again. Key rotation is not supported yet, so
never replace an existing key casually. If upgrading from the earlier app-key
variable name, copy its existing value to `FEEDBACKBEE_ENCRYPTION_KEY`; do not
generate a replacement key.

Database migrations apply on the Worker's first request
(`apps/web/src/server/worker/boot.ts`), so there is no separate migrate step.
Groot's production secrets (`JWT_SECRET_KEY`, `ADMIN_AUTH_KEY`) are generated
on first boot and kept in D1. `ORIGIN` / `RP_ID` (used by passkeys) default to
the host of the first request, but explicitly set production `ORIGIN` to the
canonical public HTTPS URL before connecting GitHub. The App registration
callback must use that public URL. Set `ORIGIN` and other overrides in Worker
vars (for example, `wrangler.jsonc`).

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
- Complete **Connect GitHub** below, then send one report from `/demo` and
  check that the issue appears in the selected repository.

## Connect GitHub

1. Open `/app`, sign in, then go to **Settings → GitHub**. Start registration
   and choose whether the private GitHub App belongs to your personal account
   or an organization. FeedbackBee uses the GitHub manifest flow; do not paste
   GitHub credentials or an App private key into settings.
2. The App needs **Issues: write** and GitHub's mandatory repository metadata
   permission only. Leave webhook delivery inactive: FeedbackBee makes
   outbound GitHub API calls and does not need webhooks.
3. Complete registration and installation on GitHub. Select the repositories
   the App may access during installation. Refresh the installation list in
   Settings to discover available installations, then choose a repository in
   each project's repository dropdown.

Each deployment has one GitHub App. It can use multiple installations when
GitHub's private App ownership and installation rules allow it. Installation
tokens are held in memory, expire automatically, and are refreshed as needed;
they are not stored in D1 or returned by the API.

Disconnecting in FeedbackBee removes its local App connection but does not
uninstall or delete the GitHub App. Existing feedback is retained. To reconnect,
register/connect again and select the same repositories. Losing
`FEEDBACKBEE_ENCRYPTION_KEY` requires disconnecting and re-registering; key rotation is
not supported yet.

For local registration, run the Worker behind a public HTTPS tunnel and set
`ORIGIN` explicitly to that tunnel's canonical URL before registering. The
local app key is the same type of secret as production: generate a random key
with `openssl rand -base64 32` and set `FEEDBACKBEE_ENCRYPTION_KEY` in `.env` for
`pnpm dev` or `.dev.vars` for `pnpm dev:worker`. Do not use localhost as the
GitHub callback origin.

## Free-tier ceilings

| Resource | Free limit       | FeedbackBee pressure                                           |
| -------- | ---------------- | -------------------------------------------------------------- |
| Workers  | 100k req/day     | Widget + API + media reads                                     |
| D1       | 5M rows read/day | Rate-limit rows dominate; prune monthly                        |
| R2       | 10 GB stored     | Recordings at ~1 MB/min; the 5-min cap bounds each at ~5-15 MB |
