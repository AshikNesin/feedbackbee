# FeedbackBee: agent guide

Self-hostable feedback widget (feedback.fish style) that files GitHub issues, on
the Cloudflare free tier. FeedbackBee is a child of the
[groot](https://github.com/AshikNesin/groot) boilerplate: `packages/*`, root
configs, `scripts/`, `docs/` and `.groot/` are synced from groot
(`pnpm groot:sync`); FeedbackBee's own code lives in `apps/web/`, `tests/worker/`,
`android/` and `site/`. Groot's guides start at [`docs/README.md`](./docs/README.md);
the product docs are [`docs/PRD.md`](./docs/PRD.md) and the upload contract
[`docs/CONTRACT.md`](./docs/CONTRACT.md).

Use **pnpm** for everything. Don't call `vp` directly (use `pnpm check`,
`pnpm test`, `pnpm build:client`). No npm or yarn.

## Non-negotiable rules

- **Never edit synced files for app needs.** `packages/**`, `scripts/**` (except
  `scripts/seed.ts`), `*.config.*`, `tsconfig*.json`, `.github/workflows/**`,
  `docs/**` (except `CONTRACT.md`, `DEPLOY.md`, `PRD.md`, `screenshots/`) come
  from groot. A real fix belongs in groot first (as `uploadPaths` was); a
  FeedbackBee-only file goes in an app-owned path or in
  `.groot/boilerplate-sync.json` → `additional_exclusions`.
- **Packages never import from `apps/`.** Apps import packages, never the reverse.
- **The upload contract is versioned.** `POST /api/v1/feedback` is called by
  shipped widgets and Android apps. A change to its fields or responses updates
  `docs/CONTRACT.md`, the widget (`apps/web/src/server/embed/widget.js`) and the
  Android SDK (`android/sdk/.../upload/`) together; a breaking change needs a new
  version path. It answers CORS `*` (`openCorsPaths`) and sets its own size
  caps (`uploadPaths`) in `app.ts`.
- **GitHub auth is one PAT**, the `GITHUB_TOKEN` Worker secret, read once at boot
  into `runtime.ts`. It only travels to api.github.com: never into D1, a log, or
  an API response. Projects store only `owner/repo`.
- **Reporter data never reaches GitHub.** `email`, `reporter_name`,
  `reporter_id`, `metadata` and `url` stay in D1 and the dashboard
  (`lib/github.ts` `issueBody`, pinned by tests).
- **Migrations: Drizzle only.** Edit `apps/web/src/server/db/schema.ts`, run
  `pnpm db:generate`, commit `apps/web/drizzle/`. Never edit an applied
  migration. Pending migrations apply on the Worker's first request
  (`worker/boot.ts`).
- **`wrangler.jsonc` is the self-host template: no account-specific ids.**
  D1 and R2 are provisioned by `wrangler deploy` / the Deploy button and reused
  after; never commit a `database_id` (decline wrangler's write-back) or a
  personal route/domain.
- **No database transactions.** D1 has none; group writes with
  `batch([...])` / `batchAll()` from `db/index.ts`.
- **Never edit `apps/web/src/server/generated/`.** Edit `embed/widget.js`, then
  `pnpm build:embed` regenerates `embed_js.ts` plus the vendored bundles from
  pinned devDependencies (`capture_js.ts` ← `modern-screenshot`, `record_js.ts`
  ← `@rrweb/record`, `player_js.ts` ← `rrweb-player`).
- **A change to a managed surface needs a changeset** (`pnpm changeset`, or a
  reason under `.changeset/no-release/`); `pnpm check:changesets` enforces it.

## Runtime

Production is Cloudflare Workers (`apps/web/src/server/entry.worker.ts`): D1,
the `MEDIA` R2 bucket, Static Assets for the dashboard SPA. Zero-config: the one
required secret is `GITHUB_TOKEN`; `worker/boot.ts` fills groot's
`JWT_SECRET_KEY` / `ADMIN_AUTH_KEY` from core's `kv` table and `ORIGIN` / `RP_ID`
from the first request when unset.

Services never read Workers bindings. Database access is Drizzle's query
builder on groot's `db` (`import { db, batch, … } from "../../db"`); media goes
through `runtime().media` (`lib/media.ts`): R2 streaming on Workers, groot's
local-disk storage adapter on Node. Not groot's `StorageAdapter` on Workers: it
buffers, and a 200 MB recording exceeds the 128 MB memory ceiling.

`pnpm dev` runs the same app on Node (SQLite in `data/`, uploads in `local/`);
`pnpm dev:worker` runs the real Worker locally.

## Auth

groot core: email + password (PBKDF2) with a JWT cookie, plus passkeys. Core has
no sign-up, so `api/auth/first-owner.ts` runs in front of
`POST /api/v1/auth/login`: while there are no users, the first sign-in creates
one with its credentials. The dashboard API (`/api/v1/projects…`) sits behind
`jwtAuthMiddleware`.

## Principles

- Thin Hono routes (`api/<feature>/<feature>.routes.ts`): parse/validate with
  Zod (`<feature>.schema.ts`), delegate to `<feature>.service.ts`, return
  `ok(c, data)`; throw `Boom` errors for failures.
- Validate untrusted input once, at the boundary. Trust internal types.
- Client code by feature (`apps/web/src/client/features/<feature>/`), pages in
  `pages/`, primitives from `@groot/ui`, chrome from `@groot/shell`
  (`pnpm check:tokens` enforces the DLS, see `docs/features/dls.md`). Response
  types come type-only from `apps/web/src/server/wire-types.ts`.
- TanStack Query for server state; list filters and the open report live in
  the URL (nuqs).
- Free-tier ceilings matter: no queues, no Durable Objects, batch D1 writes,
  media caps enforced in code. groot's job queue is off (`config.ts`).

## Surfaces

- `/`: the website (`site/`, served from Static Assets by `worker/static-assets.ts`)
- `/app`: dashboard SPA (`/app/projects`, `/app/projects/:slug?feedback=<id>`, `/app/settings`,
  `/app/login`); the old unprefixed paths 301 here
- `/api/v1/feedback`: public multipart submit (docs/CONTRACT.md)
- `/api/v1/auth/*`, `/api/v1/passkey/*`: groot auth
- `/api/v1/projects/*`, `/api/v1/settings`: dashboard API
- `/embed.js`: the widget (reads `data-project`, `data-endpoint`, `data-position`)
- `/embed-capture.js`, `/embed-record.js`: libraries the widget lazy-loads
- `/f/<key>`: public media · `/replay/<key>`: session replay viewer (`/replay-player.js`)
- `/demo`: demo page exercising the widget · `/health`, `/ready`: probes
- `site/`: the website, laid out like 404less's: `layout.html` + `pages/*.html` +
  `assets/`, assembled by `site/build.mjs` into `dist/client/` next to the SPA
  (whose `index.html` becomes `app.html`). `pnpm build:client` builds both.

## Commands

- `pnpm dev`: Node + Vite HMR at `/app` (sign in with demo@example.com / demo@example.com); the
  website is only in `pnpm dev:worker` and builds
- `pnpm dev:worker`: build the SPA, run the Worker in workerd (:8787)
- `pnpm test:worker`: FeedbackBee's integration suite in workerd (the main safety net)
- `pnpm test` / `pnpm test:client`: groot's Node and client suites
- `pnpm typecheck` · `pnpm check` · `pnpm check:tokens` · `pnpm check:worker`
- `pnpm build:embed`: after editing `embed/widget.js` or bumping a vendored library
- `pnpm db:generate`: after a schema change
- `pnpm deploy:worker`: build + `wrangler deploy` (migrations apply on first request)
- `pnpm groot:check` / `pnpm groot:sync`: boilerplate updates
- Android: `cd android && ./gradlew :sdk:assembleRelease :app:assembleDebug :sdk:testReleaseUnitTest`
