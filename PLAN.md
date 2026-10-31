# FeedbackBee → groot onboarding (record)

Onboarded onto groot `main` @ `1a38cc2` (v3.0.0), the commit 404less is synced
to, on 2026-10-31. Reference child: `~/Code/404less`. The app was new, so
backward compatibility was dropped: fresh schema, every endpoint versioned,
widget and Android SDK moved to the new contract in the same change.

## Decisions

| Area            | Before                                                              | After                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout          | flat `src/` + separate `web/` package                               | pnpm workspace: synced `packages/*` + app-owned `apps/web`                                                                                                                                 |
| Server          | hand-rolled Hono routes, raw `DB.prepare` SQL                       | `createWebApp()` on core's `createApp`; feature folders (`api/<feature>/*.routes/service/schema.ts`); Drizzle query builder; Zod at the boundary; `{success,data}` envelope; `Boom` errors |
| Schema          | hand-written `migrations/0001..0005`                                | one Drizzle baseline `apps/web/drizzle/0000_init.sql`, applied on first request (`migrateD1`); camelCase TS keys, plural table names                                                       |
| Auth            | own `admin`/`session` tables, single-pass SHA-256, `fb_session`     | groot core: PBKDF2 users, JWT cookie, passkeys; `api/auth/first-owner.ts` keeps "the first sign-in creates the owner"                                                                      |
| API             | `/api/feedback`, `/api/projects`, `/auth/*`                         | `/api/v1/feedback` (public, CORS `*`), `/api/v1/projects/*`, `/api/v1/auth/*`, `/api/v1/passkey/*`, `/api/v1/settings`                                                                     |
| Upload contract | `media` + `media_kind` (screenshot or recording), legacy kind names | screenshots are repeatable `image` parts, `media` is only a recording, kinds `issue`/`feature_request`/`other` only (docs/CONTRACT.md)                                                     |
| Media           | R2 binding used directly                                            | `MediaStore` seam (`lib/media.ts`): streaming R2 on Workers, groot's local-disk adapter on Node. Not groot's `StorageAdapter` on Workers: it buffers, and recordings go to 200 MB          |
| Rate limit      | D1 table                                                            | unchanged idea, Drizzle (`lib/rate-limit.ts`); groot's limiter is per-isolate memory or 10 s/60 s bindings, the window here is an hour                                                     |
| Secrets         | `GITHUB_TOKEN`                                                      | still the only one: `worker/boot.ts` generates `JWT_SECRET_KEY`/`ADMIN_AUTH_KEY` into core's `kv` table, `ORIGIN`/`RP_ID` from the first request                                           |
| Dashboard       | one 458-line component, hand-rolled CSS, hash routing               | React Router 7, TanStack Query, nuqs, `@groot/shell` Layout/Login/Settings, `@groot/ui` (DLS-checked); `/projects/:slug?feedback=<id>` deep links from GitHub issues                       |
| Tests           | 2 workerd suites                                                    | `tests/worker/` (45 tests, workerd, MSW for GitHub) + groot's Node (221) and client (45) suites                                                                                            |
| Jobs            | none                                                                | groot's job queue off (`config.ts`); issues still filed inline                                                                                                                             |

## Groot change made for FeedbackBee

`createApp({ uploadPaths })` (core): multipart endpoints with their own caps skip
the 1 MB JSON body limit; before, only groot's storage upload was exempt. Made
identically in `~/Code/groot` (uncommitted, with `tests/server/core/upload-paths.test.ts`
and changeset `upload-paths.md`) so the next `pnpm groot:sync` is clean.

## Follow-ups

- Commit the `uploadPaths` change in groot. Until `~/Code/groot` is clean,
  `pnpm groot:check` clones from GitHub instead of reusing the local checkout.
- Production D1: `wrangler.jsonc` carries no account ids (self-host
  template); the first `wrangler deploy` creates `feedbackbee` and reuses the
  `feedbackbee-media` bucket. The pre-groot `feedbackbee` DB and the interim `feedbackbee-v1` were
  deleted on 2026-10-31; the live Worker needs a deploy to bind the new `feedbackbee` DB.
- Android SDK: release a new version for the v1 contract. Its unit tests were
  updated but not run here (needs JDK ≤ 23 for Gradle 8.10).
- Re-shoot `docs/screenshots/` for the new dashboard.
- groot's `.claude/settings.json` and react-doctor skill were not copied
  (protected path in this session).
