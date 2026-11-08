# Architecture

How the server is put together and the conventions every feature module
follows. The same Hono app runs on Node and on Cloudflare Workers; only the
entry file differs.

## Layout

```
packages/core/src/                 # Boilerplate (synced)
├── app.ts                         # createApp(): middleware, /health, /ready, error envelope
├── bootstrap.ts                   # env → config → logger → db → storage → error reporter
├── env.ts · config.ts             # Zod env schema · typed AppConfig + defineConfig()
├── context.ts                     # AsyncLocalStorage request context, waitUntil()
├── types.ts                       # AppEnv (Hono generics), AuthUser
├── database/                      # db handle (index.ts), core tables (schema.ts), Node driver (node.ts), D1 migrator (d1.ts)
├── auth/ passkey/ settings/       # Reusable feature modules (routes + service + schema); import the module, there is no barrel
├── storage/                       # StorageAdapter contract, local/R2/memory adapters, routes
├── kv/ logger/ errors/            # kv table store · structured logger + breadcrumbs · HttpError, Boom, toHttpError, reporting seam
├── session/                       # startSession() / endSession() / requireSession guard; JWT (token.ts), cookie (cookie.ts)
├── notification/                  # startup notification the Node entry sends in production
├── middlewares/                   # request logger, admin key, rate limit, error handler
└── utils/                         # ok()/noContent(), parseBody()/parseQuery()/parseId(), password

packages/jobs/src/server/          # queue, transitions, tick (runner), worker, dashboard API — see features/jobs.md

apps/web/src/server/               # App-owned (not synced)
├── app.ts                         # startWebApp(): bootstrap + register job handlers + createWebApp()
├── config.ts                      # defineConfig() overrides
├── entry.node.ts · entry.worker.ts
├── db/schema.ts                   # app tables; drizzle-kit entry (re-exports core + jobs tables)
├── db/node.ts                     # openDatabase(url): SQLite with migrations applied (Node entry, scripts, tests)
└── api/<feature>/                 # feature.routes.ts, .service.ts, .schema.ts, .jobs.ts
```

## Request flow

```
HTTP request
  → requestLoggerMiddleware   request id (x-request-id), child logger, AsyncLocalStorage context, one log line
  → cors                      config.cors.origins (empty = reflect the requesting origin)
  → bodyLimit                 1 MB on /api/*, unless the matched route declares its own (routeBodyLimit)
  → router                    new Hono<AppEnv>() mounted by createWebApp() in apps/web/src/server/app.ts
  → handler                   await parseBody(c, schema) → service → ok(c, data, status?)
  → service                   Drizzle query builder → SQLite
  → errorHandler              toHttpError(thrown) → { success: false, error: { code, message, details } }
```

`/api/v1/auth` and `/api/v1/passkey` are mounted directly (their login routes
are public and rate-limited); every other router is mounted on a sub-app that
runs `requireSession` first. An unknown route gets the same envelope with a
404 `NOT_FOUND`.

## Writing a feature module

A feature is one folder, `apps/web/src/server/api/<feature>/`: a Zod schema,
a service that calls Drizzle directly (there is no model layer), a plain Hono
router whose handlers parse, call the service and return the envelope, and
optionally job handlers. [Development workflow](./development.md#adding-a-feature-end-to-end)
builds one end to end; [Todos](../features/todos.md) is the reference module.
Handlers use these helpers:

| Helper (`@groot/core/utils/…`)                    | Does                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `parseBody(c, schema)` (async)                    | JSON body through Zod; bad JSON or validation → 400 with field details |
| `parseQuery(c, schema)`, `parseParams(c, schema)` | Query string / route params through Zod                                |
| `await parseForm(c, schema)`                      | Multipart / urlencoded body through Zod (repeated fields are arrays)   |
| `parseId(value)`, `parseStringParam(value)`       | Positive integer id / required string param, else 400                  |
| `requireUser(c)`                                  | The JWT user (`{ userId, email }`), else 401                           |
| `clientIp(c)`                                     | The client's address from the runtime's resolver, or `unknown`         |
| `ok(c, data, status = 200)`                       | `{ success: true, data }`                                              |
| `noContent(c)`                                    | 204                                                                    |
| `fail(c, error, status)`                          | `{ success: false, error }` (used by the error handler)                |

Errors come from `@groot/core/errors`. Throw a `Boom.*` factory for expected
failures (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, …).
Each takes `(message?, data?, code?)`: `data` becomes `error.details` and
`code` is any string (`Boom.notFound("Job not found", null, "JOB_NOT_FOUND")`);
`Boom.boomify(err, { statusCode })` covers any other status. The error handler
normalises whatever was thrown with `toHttpError()`: an `HttpError` passes
through, SQLite constraint failures are mapped (`UNIQUE` → 409, `FOREIGN KEY` /
`NOT NULL` / `CHECK` → 400), and Hono's `HTTPException` keeps its status. A
4xx logs a warning. A 5xx or anything unrecognised logs an error with the
request's breadcrumbs and goes to `reportError()`; an unrecognised error
returns a 500 whose message is only shown in development.

## Database

Drizzle on SQLite, nothing else. `db` from `@groot/core/database` is a live
binding set by `bootstrap()`: better-sqlite3 (sync driver) on Node, D1 (async
driver) on Workers. Code that `await`s the query builder works on both. Rules:
query builder only, no `db.transaction()` (D1 has none), timestamps as
`integer({ mode: "timestamp_ms" })`, JSON as `text({ mode: "json" })`. Tables
live in three schema files; `apps/web/src/server/db/schema.ts` re-exports them
all and is the drizzle-kit entry. See [Database migrations](./database-migrations.md).

## Bootstrap and the two runtimes

`bootstrap({ env, config, db, storage, reportError })` wires, in order, env →
config → logger → db → storage → error reporter (see
[boot order](../reference/config.md#boot-order)). Nothing calls it directly:
both entries, `scripts/seed.ts` and the test setup go through
`startWebApp(runtime)` in `apps/web/src/server/app.ts`, which adds the app
config, registers the job handlers and builds the app. A runtime supplies only
its env source and adapters:

|                | `entry.node.ts`                                                                                                                                       | `entry.worker.ts`                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| env            | `process.env` (+ `.env` via `process.loadEnvFile` when present)                                                                                       | Worker vars + secrets bindings                                                          |
| db             | `openDatabase(DATABASE_URL)` (`db/node.ts`), migrates on boot                                                                                         | `drizzle(env.DB)` (D1); `migrateD1()` on the first request of an isolate                |
| storage        | `localStorage(uploadsRoot(env))`: `UPLOADS_DIR`, else `uploads/` next to the SQLite file in production (`/data/uploads`), `./local/uploads` otherwise | `r2Storage(env.STORAGE)` when the bucket is bound                                       |
| client address | `peerClientAddress(getConnInfo)`: the socket peer, or the hop a `TRUSTED_PROXIES` proxy vouches for                                                   | `cloudflareClientAddress`: `cf-connecting-ip`                                           |
| rate limits    | `memoryRateLimitStore()`                                                                                                                              | `cloudflareRateLimitStore(env)`: the `*_RATE_LIMITER` bindings, else per-isolate memory |
| errors         | `@sentry/node` when `config.sentry.dsn` is set                                                                                                        | `@sentry/cloudflare` `withSentry`, same config                                          |
| client         | Vite middleware (dev) / `dist/client` + SPA fallback (prod)                                                                                           | Static Assets; `run_worker_first` for `/api/*`, `/health`, `/ready`                     |
| jobs           | `startWorkers()` poller when `config.jobs.enabled`                                                                                                    | `scheduled` handler → `runTick()`                                                       |
| shutdown       | `SIGTERM` / `SIGINT` → `/health` 503 → stop workers → close                                                                                           | n/a                                                                                     |

Core stays runtime-neutral: Web APIs only (`crypto.subtle`, `fetch`,
`TextEncoder`), with `node:` imports confined to `database/node.ts`,
`storage/node.ts`, `node:async_hooks` and `node:buffer` (both provided by
Workers under `nodejs_compat`).

## Storage

`storage` from `@groot/core/storage` is whatever `StorageAdapter` the entry
injected: `put / get / head / delete / list / copy` over `/`-separated keys,
folders as common prefixes. Three adapters ship (local filesystem, R2 bucket
binding, memory for tests); another backend is one file implementing the
interface in `packages/core/src/storage/adapter.ts`. See [File storage](../features/storage.md).

## Rate limits and client addresses

`rateLimit({ window, message, binding })` in
`packages/core/src/middlewares/rate-limit.middleware.ts` counts requests per
client in the app's `RateLimitStore` (`packages/core/src/rate-limit/store.ts`):
`hit(key, rule)` answers `{ allowed, limit?, remaining?, resetAt? }`. Two
adapters ship, and `tests/server/core/rate-limit-stores.test.ts` runs one
contract suite against both:

- `memoryRateLimitStore()`: fixed-window counters, exact in one Node process.
  Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and
  `RateLimit-Reset`, and a 429 also `Retry-After`.
- `cloudflareRateLimitStore(bindings)` (`packages/core/src/rate-limit/cloudflare.ts`): each
  limiter's Workers Rate Limiting binding (`AUTH_RATE_LIMITER`, ...), shared
  by every isolate, with per-isolate memory for one that is not bound. A
  binding enforces its own limit and period from `wrangler.jsonc` and answers
  only yes or no, so its responses carry none of those headers.

The client is whatever the runtime's `ClientAddressResolver`
(`packages/core/src/utils/client-ip.ts`) says, read through `clientIp(c)`. The
entries pass the resolver and the store through `startWebApp()` to
`createApp({ clientAddress, rateLimitStore })` (see the table above). Each
`createApp()` call gets counters of its own, so test apps never share them.
An app given neither keeps working: it reads @hono/node-server's socket or
else `cf-connecting-ip`, and counts in a binding on `c.env` when the limiter
names one, else in memory. Tests pass a resolver
(`createTestApp({ clientAddress })`) instead of faking a socket.

## Body limits

`createApp()` caps every `/api/*` body at `bodyLimitBytes` (1 MB). A route
that takes bigger bodies declares its own limit with `routeBodyLimit(bytes)`
from `packages/core/src/middlewares/body-limit.middleware.ts`, as the storage
upload does with 100 MB; the app's limit skips every request such a route
matches, so the route's limit holds wherever its router is mounted. Both are
Hono's `bodyLimit`: a declared `Content-Length` over the limit is refused
before the body is read, and a streamed body is refused once it passes the
limit. The refusal is a bare 413 unless the route passes
`routeBodyLimit(bytes, { onError })`, whose handler can throw a worded
`Boom.entityTooLarge(...)`. The older `uploadPaths` option, which skips the limit by path, still
works but is deprecated.

## Background jobs

The `jobs` table is the queue. `addJob()` inserts a row; `runTick()` claims and
runs due rows; the Node poller or the Workers cron trigger calls it. Handlers
are registered by `startWebApp()`: add a feature's registration to
`registerJobHandlers()` in `apps/web/src/server/app.ts`. Details in [Background jobs](../features/jobs.md).

## Logging and request context

`logger` from `@groot/core/logger` is a small structured logger:
`logger.info({ userId }, "Signed in")`, `logger.child({ component })`, levels
`trace` … `fatal`. Output is a readable line outside production and JSON lines
in production (`configureLogger` is called by `bootstrap`). Before a record is
written, fields named like secrets (`password`, `secret`, `authorization`, …)
become `[REDACTED]` and every string goes through the app's scrubber, if one
is set with `setScrubber()`. A child can carry a record sink
(`logger.child(bindings, { sink })`, inherited by its children) that receives
every record whatever the console level; the jobs package persists job logs
this way.

The request context (id, start time, breadcrumbs, `waitUntil`) lives in AsyncLocalStorage:
`addBreadcrumb("auth", "token verified")` records a step that is attached to
the next error log; `waitUntil(promise)` keeps a Workers request alive for
background work and simply detaches on Node. `reportError(error, context)` is
the seam the entries point at Sentry.

## Key-value store

`kv` from `@groot/core/kv` is a JSON key-value API over the `kv` table with
optional TTL; app settings and passkey challenges use it. See [KV](../features/kv.md).

## Authentication

| Layer     | Routes                                                                         | Requirement                                                                            |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Public    | `POST /api/v1/auth/login`, `POST /api/v1/passkey/login/*`, `/health`, `/ready` | none (login routes: 20 requests / 15 min per IP)                                       |
| Setup     | `GET` / `POST /api/v1/auth/setup`                                              | none, but `POST` only succeeds while no user exists (403 after; rate-limited as login) |
| Protected | everything else under `/api/v1`                                                | JWT in the `token` httpOnly cookie or `Authorization: Bearer …` (`requireSession`)     |
| Admin     | `POST` / `GET /api/v1/auth/users`                                              | `X-Admin-Auth-Key` equal to `ADMIN_AUTH_KEY` (`adminAuthMiddleware`)                   |

Passwords are PBKDF2-SHA256 (100,000 iterations through WebCrypto); tokens are
HS256 via jose, valid for `config.auth.jwtExpiresIn` (30 days).

The session is one module, `@groot/core/session`
(`packages/core/src/session/index.ts`). A sign-in path (password login,
first-run setup, passkey login) has its service prove who the user is and
return the account; the route then calls `startSession(c, account)` once,
which mints the token, sets the cookie and returns the body every sign-in
route sends, `{ token, user }` (`SignInResponse`, with `user` exactly the
`SessionUser` fields; the token is for non-browser clients). `endSession(c)`
clears the cookie. `requireSession` is the guard: it reads the cookie, else the
bearer token, verifies it, checks the account still exists and sets
`c.get("user")`. It alone answers 401 `SESSION_INVALID`, the code the client
signs out on (R9); a wrong password or passkey is a plain 401 `UNAUTHORIZED`.
`jwtAuthMiddleware`, `utils/jwt.utils` and `utils/auth-cookie.utils` remain as
deprecated aliases.

## Client

React Router 7 (`apps/web/src/client/App.tsx`), the session store
(`@groot/shell/store/auth`, Zustand: the user, sign-in and sign-out; the JWT
stays in the HttpOnly cookie), React Query over a `fetch` client
(`@groot/shell/lib/api`: `/api/v1` prefix, sends the cookie, unwraps `data`,
throws `ApiError`), `@groot/ui` primitives. See [Client](../features/client.md).

## Design principles

| Principle                 | What it means                                                           |
| ------------------------- | ----------------------------------------------------------------------- |
| One app, two entries      | Runtime-specific code lives only in `entry.node.ts` / `entry.worker.ts` |
| Feature isolation         | A feature is one folder: schema, service, routes, jobs                  |
| Parse at the edge         | Zod on every body, query and param; services receive typed data         |
| One envelope              | `ok()` / `noContent()` / thrown `Boom` — never hand-built JSON          |
| The database is the queue | Jobs, schedules, logs, kv are tables, not services                      |
| Boring persistence        | Query builder, no transactions, generated migrations                    |
