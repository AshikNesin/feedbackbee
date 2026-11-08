# @groot/core

## 2.2.0

### Minor Changes

- [#165](https://github.com/AshikNesin/groot/pull/165) [`b3039be`](https://github.com/AshikNesin/groot/commit/b3039befd01979bcdc9f655fcf41e55a47a8e879) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(settings): adding an existing setting no longer wipes its value; drafts survive refetches
  
  "Add setting" saved `{}` through the `PUT` upsert, so adding a key that
  already existed replaced its value. The settings page also replaced unsaved
  edits whenever a refetch brought a new server value, and switching settings
  dropped a dirty draft without a word.
  
  - `@groot/core`: `POST /api/v1/settings` (`{ key, value, metadata? }`)
    creates a setting and answers 409 for a key that exists; `PUT` keeps its
    upsert semantics for saving. It writes through the new `KvStore.add(key,
    value, ttlMs?)`, an insert-only write in one statement that resolves false
    when a live entry holds the key.
  - `@groot/shell`: `useAppSettingsData()` is the data (settings, `get`, `save`,
    `create`, `remove`); `create` refuses a key the list holds without a
    request. `useSettingDraft(setting)` is one editor draft with `isDirty`,
    `serverChanged`, `discard()` and `parse()`: a refetch leaves a dirty draft
    alone, and `AppSettings` asks before leaving one. `useAppSettings()` keeps
    its shape on top of the two and is deprecated.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`f44c850`](https://github.com/AshikNesin/groot/commit/f44c850f3f632ca54c01f6e265c643020ccfe4f8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(core): `KvStore.take` and `KvStore.claim`, single-statement consume and claim
  
  - **`take(key)`** deletes a live entry and returns its value in one
    `DELETE … RETURNING` (`undefined` when missing or expired). Of any number of
    concurrent `take`s of one key, exactly one gets the value.
  - **`claim(key, intervalMs)`** is one compare-and-set upsert that returns
    `true` for at most one caller per interval, across processes and Workers
    isolates. The value is the claim time in epoch ms; the row expires with the
    claim.
  - **Fix: passkey challenge replay.** Verification consumed a challenge with
    `has()` then `delete()`, so two concurrent verifications of one challenge
    could both pass. It now uses `take`.
  - `@groot/jobs`: the tick's housekeeping slot is claimed with `kv.claim`
    instead of a hand-written upsert on the `kv` table. The key and value format
    (`jobs:housekeeping:lastRunAt`, epoch ms) are unchanged, so existing rows
    keep working.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`1abd148`](https://github.com/AshikNesin/groot/commit/1abd148fc59353dbc4b3f629af9449ec1eb25896) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(core): one session module, `@groot/core/session`
  
  Starting a session (mint the JWT, shape the user, set the cookie) was spread
  over three services and two routers, and the user shape had drifted: passkey
  login returned the whole account row minus the password, `createdAt` and
  `updatedAt` included. Now:
  
  - **`startSession(c, account)`** mints the token, sets the `token` cookie and
    returns the body every sign-in route sends, `{ token, user }`, typed
    `SignInResponse` in `@groot/core/auth/auth.schema` (the wire type, next to
    `SessionUser`). `user` is exactly `{ id, email, name }` whatever record is
    passed. Password login and first-run setup answer as before; **passkey login
    now returns the same `user` shape** (no `createdAt`/`updatedAt`).
  - **`endSession(c)`** clears the cookie; **`requireSession`** is the session
    guard (cookie, else bearer; the account must still exist; sets
    `c.get("user")`). `sessionInvalid()` is private to the module, so only the
    guard can answer 401 `SESSION_INVALID`. `verifySessionToken(token)` checks a
    token outside HTTP.
  - The services return the account and the routes sign it in:
    `authService.authenticate()` and `authService.setupFirstUser()` return the
    user, and `passkeyService.authenticatePasskey()` replaces
    `verifyAuthentication()`. `authService.toPublicUser()` is new.
  - **Deprecated** (still working, removed in the next major):
    `jwtAuthMiddleware` (use `requireSession`); `generateToken`, `verifyToken`
    and `jwtExpiresInMs` in `utils/jwt.utils` (now `signSessionToken`,
    `verifySessionToken`, `sessionLifetimeMs`); `setAuthCookie`,
    `clearAuthCookie` and `extractAuthToken` in `utils/auth-cookie.utils`;
    `authService.login()`, `authService.createFirstUser()` and
    `passkeyService.verifyAuthentication()`, which still return
    `{ token, user }` without setting the cookie.
  - **Removed:** `sessionInvalid` from `utils/jwt.utils`. Lint rule R9 already
    allowed it only in the session guard, so no conforming caller used it.
  - Fix: the login comment no longer claims bcrypt hashes are upgraded;
    `verifyPassword` accepts only PBKDF2-SHA256.
  
  Apps: `apps/web/src/server/app.ts` guards the protected sub-app with
  `requireSession` from `@groot/core/session`.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`f4022b4`](https://github.com/AshikNesin/groot/commit/f4022b454292fa768d71aea5efd1a496501dfc57) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Rate limits count in a `RateLimitStore` the runtime supplies, and the runtime says who the client is.
  
  - **Stores.** `rateLimit()` asks the app's store (`hit(key, rule)` → `{ allowed, limit?, remaining?, resetAt? }`). Two adapters ship: `memoryRateLimitStore()` in `@groot/core/rate-limit/store` and `cloudflareRateLimitStore(bindings)` in `@groot/core/rate-limit/cloudflare`, which uses each limiter's Workers Rate Limiting binding and memory for one that is not bound. Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` whenever the store reports them, and a 429 also `Retry-After`; the Cloudflare binding reports only allowed or not, so its responses carry none.
  - **Per app.** Each `createApp()` call gets counters of its own, so test apps no longer share one bucket per test file. `createApp({ rateLimitStore })` picks the store; without one, a binding on `c.env` wins as before, else memory.
  - **Client address.** `createApp({ clientAddress })` takes a `ClientAddressResolver` (`@groot/core/utils/client-ip`): `peerClientAddress(peer)` for Node (the socket peer, or the hop a `TRUSTED_PROXIES` proxy vouches for, as before) and `cloudflareClientAddress` for Workers. `clientIp(c)` reads it. Without one, core still reads @hono/node-server's socket, else `cf-connecting-ip`.
  - `AppEnv` variables gain `clientAddress` and `rateLimitStore`; `RateLimitOptions` gains `name`. The exported limiters (`authRateLimiter`, `storageRateLimiter`, `uploadRateLimiter`) are unchanged.
  
  To adopt in an app: pass `clientAddress: peerClientAddress((c) => getConnInfo(c).remote.address)` and `rateLimitStore: memoryRateLimitStore()` from `entry.node.ts`, and `clientAddress: cloudflareClientAddress` and `rateLimitStore: cloudflareRateLimitStore(bindings)` from `entry.worker.ts`, through `startWebApp()` (`WebRuntime` now picks both from `CreateAppOptions`).

- [#165](https://github.com/AshikNesin/groot/pull/165) [`494007f`](https://github.com/AshikNesin/groot/commit/494007f804a7ad3c83c2413b2222b1bc9d0b59ac) Thanks [@AshikNesin](https://github.com/AshikNesin)! - A route declares its own body limit with `routeBodyLimit(bytes)` (`@groot/core/middlewares/body-limit.middleware`), and the app's 1 MB `/api/*` limit skips every request such a route matches, so the limit holds wherever the router is mounted. Storage uploads use it for their 100 MB limit, so `createApp()` no longer hard-codes `/api/v1/storage/files/upload`, and mounting the storage router elsewhere keeps large uploads working. Streamed bodies are still counted as they arrive. `CreateAppOptions.uploadPaths` still works but is deprecated: declare the limit on the route instead.

## 2.1.1

### Patch Changes

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): take the latest compatible releases
  
  Vite+ 1.5 with Vitest 5.1, hono 4.13, jose 6.2.15, motion 14.10, Tailwind
  4.3.5, wrangler 4.158 and jsdom 31. `@earendil-works/pi-ai` stays at 1.4.0:
  1.5.0 drops `Type`, `TSchema` and `Static` from its `compat` entry, which
  `@groot/ai` imports.

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): upgrade dependencies to the versions tiny-agents runs
  
  Every dependency groot shares with tiny-agents now matches its version, so a
  sync no longer conflicts on version ranges.
  
  - **Majors.** Vite+ 1.4 with Vitest 5, Sentry 11 (`@sentry/node`,
    `@sentry/cloudflare` and the build plugins), SimpleWebAuthn 14,
    better-sqlite3 13, jsdom 30, `@testing-library/jest-dom` 7,
    `@hookform/resolvers` 6, `@types/node` 26, changesets 3 (with
    `@changesets/changelog-github` 1) and `openai` 7.
  - **Minors and patches.** React 19.3, radix-ui 1.8, lucide-react 1.61, zod 4.6,
    TanStack Query 5.104, the CodeMirror pins, pi-ai 1.4 and the rest.
  - **Call sites.** Sentry 11 dropped `sendDefaultPii`; its `dataCollection`
    defaults already attach user info, cookies and headers, so both entries just
    drop the option. SimpleWebAuthn 14 renamed `AuthenticatorTransportFuture` to
    `AuthenticatorTransport`.
  - **Changesets 3** skips private packages unless asked, so
    `.changeset/config.json` sets `privatePackages: { version: true, tag: false }`
    to keep versioning the private kit packages (tags still come from the
    release workflow).

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(kit): upstream the kit fixes and features made first in tiny-agents
  
  - **`@groot/ui`: Fluid motion in the primitives.** New `@groot/ui/motion`
    entry (`spring` tiers, `useModalPresence`, `FluidHighlight`). `Dialog` and
    `AlertDialog` spring in and stay mounted through their exit; `DialogContent`
    gains `size` (`sm` 400px default, `md`, `lg`, `xl`) and `position`
    (`center` / `top`). `TabsList` slides its selected pill (or `line`
    underline) and shows a hover pill; `Tooltip` is an inverted chip that springs
    in and fades out, with a 200ms provider delay; `Select`, `DropdownMenu` and
    `Command` share one gliding row highlight; `CommandDialog` opens top-anchored
    at `lg`, and `Command` gains a `CommandFooter` of keyboard hints. Existing
    props are unchanged. Client tests should set
    `MotionGlobalConfig.skipAnimations = true` (see `tests/client/setup.ts`).
  - **`@groot/ui`: `Breadcrumbs`.** `<Breadcrumbs page={job.name}><Link to="/jobs">Jobs</Link></Breadcrumbs>`
    places the list items and separators, so a separator can't land inside an
    item. Storage (`@groot/shell`) and JobDetail (`@groot/jobs`) use it.
  - **`@groot/shell`: login returns to the page that asked for it.**
    `ProtectedRoute` passes the location to `/login`, and a successful password
    or passkey sign-in goes back there (in-app paths only) instead of `/`.
  - **`@groot/shell`: Inter is no longer imported by `index.css`.** Tailwind
    inlined that `@import` before Vite saw it, so the font files were never
    emitted and production served `index.html` in their place. Import it from
    your client entry instead: `import "@fontsource-variable/inter";` before
    `import "@groot/shell/index.css";`.
  - **`@groot/shell`: fixes.** Auth pages use `min-h-dvh`; the dev demo
    credentials have a space after the label; the page scrollbar follows the
    theme; Storage's icon buttons have accessible names, its select column has a
    screen-reader header, folders show `-` for Modified instead of the epoch,
    folder names have readable contrast, and viewing a UTF-8 text file no longer
    shows mojibake. The row buttons' names include the file name, so an e2e
    locator like `getByRole("cell", { name })` needs `exact: true`. The passkey card title is a level-2 heading.
  - **`@groot/jobs`: accessible state filter.** The overflow state menu sits
    beside the tab list (a tablist may only hold tabs) and has a label.
  - **`@groot/core`: fixes.** Storage downloads of `text/*` with no charset are
    served as `charset=utf-8`. Login re-hashes a password stored with an older
    PBKDF2 iteration count (`needsRehash`).
  - **App: missing build files 404.** The Node SPA fallback answers a request for
    a missing asset (`/assets/*`, common static extensions) with a 404 instead of
    `index.html`, and the client reloads once when a lazy chunk fails to load
    after a deploy.

- [#155](https://github.com/AshikNesin/groot/pull/155) [`bd42693`](https://github.com/AshikNesin/groot/commit/bd426933e3274957888307f580b9949aa9ca6ffb) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): `@types/better-sqlite3` 9
  
  The type definitions for better-sqlite3 13 (the runtime moved in the previous
  upgrade); no source change was needed.

- [#156](https://github.com/AshikNesin/groot/pull/156) [`6e83765`](https://github.com/AshikNesin/groot/commit/6e83765462d2d7cab627c572fc20092f073859ba) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): `@cloudflare/workers-types` 5
  
  The v5 typings declare R2's `list({ include })`, so the R2 adapter types its
  list options as `R2ListOptions` instead of relying on an untyped object.

## 2.1.0

### Minor Changes

- [#149](https://github.com/AshikNesin/groot/pull/149) [`0bbf92f`](https://github.com/AshikNesin/groot/commit/0bbf92f21c56d4f7c8a0a874782a6787b8b83f53) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add first-run setup: create the first user from the browser at `/setup`.

  `@groot/core` adds `GET /api/v1/auth/setup` (`{ needsSetup }`) and
  `POST /api/v1/auth/setup`, which creates the first account and signs it in
  (cookie + token, like login). It answers 403 once any user exists and is
  rate-limited like login. The service gains `hasAnyUser()` and
  `createFirstUser()`; the schema exports `SetupStatus`.

  `@groot/shell` adds the `Setup` page (`@groot/shell/pages/auth/Setup`), the
  `useSetupStatus()` hook and the store's `setup()` action. `Login` redirects to
  `/setup` while no user exists, and `Setup` redirects to `/login` once one
  does. Apps mount it with `<Route path="/setup" element={<Setup />} />`.

- [#151](https://github.com/AshikNesin/groot/pull/151) [`1faa763`](https://github.com/AshikNesin/groot/commit/1faa7639c5a63dbb75f53b7006b9d551d78f845c) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Upstreamed from tiny-agents: the session guard and client-address fixes.

  - **Session guard.** `jwtAuthMiddleware` now looks up the account behind a valid token. A token for a deleted account gets a 401 coded `SESSION_INVALID` (`sessionInvalid()` in `@groot/core/utils/jwt.utils`, `ErrorCode.SESSION_INVALID`). Before, a removed user's token kept working until it expired. The shell's `apiClient.onUnauthorized` now fires only on that code, so a wrong password or another 401 no longer signs the user out. `ApiError` gains `fromServer`.
  - **Client address.** `clientIp()` now keys on the socket peer. It trusts `X-Forwarded-For` only when the peer is in the new `TRUSTED_PROXIES` (IPv4 and IPv6 addresses or CIDR ranges; unset means loopback and the private ranges, including `fc00::/7`; `none` means no proxy). Before, any client could rotate `X-Forwarded-For` to get past the login rate limit. On Workers, `cf-connecting-ip` is still the client. The rate limiter keys an IPv6 client by its /64. An entry with host bits set (`10.0.0.1/8`) fails at boot.

## 2.0.0

### Major Changes

- [`df27e7b`](https://github.com/AshikNesin/groot/commit/df27e7b99478ad44ee400f69ebd523d23a1ff404) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Dead surface removed.

  - **Breaking:** the `@groot/core/auth`, `@groot/core/passkey` and `@groot/core/settings` entrypoints (barrel re-exports) are removed; nothing imported them. Import the modules directly: `@groot/core/auth/auth.routes`, `@groot/core/passkey/passkey.service`, `@groot/core/settings/app-settings.schema`, etc.
  - **Breaking:** `created()` is removed from `@groot/core/utils/api-response.utils`; use `ok(c, data, 201)`.
  - **Breaking:** the `NewUser`, `NewPasskey` and `KvRow` type aliases are removed from `@groot/core/database/schema` (no readers); use `typeof users.$inferInsert` and friends where needed.
  - `parseParams` and the `Middleware` type stay: the storage routes validate folder params with `parseParams`, and downstream apps type middleware with `Middleware`.

- [`e0a63a9`](https://github.com/AshikNesin/groot/commit/e0a63a9b46d73c1eaadee94280c12fc5f2c5b014) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The env schema holds only what is read through the validated `env`.

  - **Breaking:** `OPENAI_API_KEY` and `SOURCE_COMMIT` are removed from `envSchema` and the `Env` type. Nothing read them through `env`: the OpenAI and pi-ai SDKs read provider keys from `process.env` themselves, and `SOURCE_COMMIT` is a build-time input of `scripts/build.mjs` and `vite.config.ts`. Migration: read `process.env.OPENAI_API_KEY` directly, or pass `apiKey` to the `@groot/ai` client.
  - `config.sentry` gains `release` (from `SENTRY_RELEASE`). Groot's Node and Worker entries now start Sentry from `config.sentry` instead of raw `process.env` / bindings, so a `defineConfig({ sentry: { dsn } })` override applies to both.
  - `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID` and `DEFAULT_MODEL` stay in the schema for app code that configures `@groot/ai`; their doc comments say so.
  - `docs/reference/config.md` states the rule: env is secrets and runtime facts, validated once; config is tunables with defaults set by `defaultConfig()` and overridden with `defineConfig()`.

- [`28e8bd3`](https://github.com/AshikNesin/groot/commit/28e8bd3a8a45f12ce9474f6dd76b3396603cdcaa) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One HTTP-error module: `packages/core/src/errors` collapsed from six files into one `index.ts` holding `HttpError`, the `Boom` factories, the SQLite constraint mapping, the thrown-value normalisation and the error-reporting seam.

  - **Breaking:** unused `Boom` factories removed (`paymentRequired`, `methodNotAllowed`, `notAcceptable`, `clientTimeout`, `gone`, `teapot`, `locked`, `illegal`, `internal`, `notImplemented`, `gatewayTimeout`). `Boom.boomify(err, { statusCode })` covers arbitrary statuses.
  - **Breaking:** the object-form `BoomOptions` overload is gone; factories take `(message?, data?, code?)` and `code` is now any string, not just `ErrorCodeValue`.
  - **Breaking:** `HttpError.isServer` removed (no readers); use `statusCode >= 500`.
  - **Breaking:** `ErrorCode` keeps only the codes core itself uses (`VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `UPLOAD_RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`); the `ErrorCodeEnum`/`ErrorCodeKey` aliases and `isDbConstraintError` are removed. The job-domain codes (`JOB_NOT_FOUND`, `JOB_NAME_INVALID`, `JOB_SCHEDULE_VALIDATION_ERROR`) moved from core into `@groot/jobs` as plain string codes.
  - `toHttpError` is now the single normaliser the error handler uses: `HttpError` passes through, SQLite constraints map to 409/400, Hono's `HTTPException` keeps its status, anything else becomes a 500. `reportError`/`setErrorReporter` are unchanged.

  Migration: replace removed factories with the nearest kept one or `boomify`; pass domain codes as string literals.

- [`2861fa1`](https://github.com/AshikNesin/groot/commit/2861fa1b43fc745c4a83117d75587ecfcfb5df47) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One logger module: `packages/core/src/logger` collapsed from five files into one `index.ts` holding the logger, levels, breadcrumbs, the performance helper and two seams — a per-child **record sink** (`child(bindings, { sink })`, inherited by grandchildren) and the process-wide **scrubber** (`setScrubber`/`scrubValue`/`scrubText`) that runs every field and message through the app's secret redaction before anything is written.

  - **Breaking:** `createRequestLogger`, `logBusinessEvent`, `clearBreadcrumbs`, `sanitizeRequestBody` and the `RequestDescriptor`/`LogBusinessEventOptions` types are removed. The request-logger middleware builds its child logger inline (`reqId`, `method`, `url`, `userAgent`, `ip` bindings unchanged); a failed request now logs one error line plus the request line instead of three.
  - The jobs logger is now a core child logger with a persistence sink: `createJobLogger({ jobId, jobName, additionalContext })` and `flushJobLogs()` keep their signatures, argument handling and scrubbing come from core. Sinks fire regardless of the global console level (a `silent` console still leaves a job trail); rows are filtered by the sink, not the level.

- [`9613dad`](https://github.com/AshikNesin/groot/commit/9613dad11d403526d08492a74b3b0546bda1c34e) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One boot sequence for the entries, the scripts and the tests.

  - **Breaking:** the `prettyLogs` bootstrap option is removed (it had no effect worth keeping: pretty is now simply on outside production). `hasDb()` is removed from `@groot/core/database` (no callers).
  - The app owns the boot sequence: `startWebApp(runtime)` in `apps/web/src/server/app.ts` runs `bootstrap()` with the app config, registers job handlers and returns the HTTP app. Both entries shrink to building their adapters, and `scripts/seed.ts` and `tests/e2e/global-setup.ts` share one `seed()`.
  - **Breaking (app-level, not kit):** `GROOT_MIGRATIONS_DIR` is gone; `openDatabase(url)` in `apps/web/src/server/db/node.ts` is the one place that knows the migrations folder (`apps/web/drizzle` in the repo, `dist/server/drizzle` next to the bundle), used by the Node entry, `scripts/db-migrate.ts`, `scripts/seed.ts` and the test setup.
  - `registerJobHandlers()` is no longer exported from `apps/web/src/server/app.ts`; `startWebApp()` runs it.

- [`a17ed96`](https://github.com/AshikNesin/groot/commit/a17ed960618f9e4bc38a57d4e8dd3f14bd16e0d7) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The server owns passkey policy; the client renders it.

  - **`@groot/core`**: `GET /api/v1/passkey/list`, `POST /register/verify` and `PATCH /:id` return `PasskeySummary` = `{ id, credentialName, kind, label, backedUp, canDelete, lastUsedAt, createdAt }`. `kind` (`"security-key" | "synced" | "device"`) and `label` come from the new `describePasskey()` in `passkey/webauthn.utils`; `canDelete` is `false` for a user's last passkey, which the server already refused to delete. The raw `userId`, `counter`, `transports`, `deviceType` and `updatedAt` fields are no longer returned; read the `passkeys` table if you need them. No schema change.
  - **`@groot/core`**: `POST /login/verify` no longer accepts `email` (nothing read it; extra keys are ignored), and `verifyAuthentication()` drops the parameter. `POST /login/options` keeps its optional `email`. Removed the unused `VerifyRegistrationDTO`, `VerifyAuthenticationDTO`, `GenerateAuthenticationOptionsDTO` and `UpdatePasskeyNameDTO` types from `passkey/passkey.schema`; use `z.infer<typeof …Schema>`.
  - **`@groot/shell`**: the `Passkey` type in `services/passkey` is the summary above. `PasskeyManager` picks the icon from `kind`, shows `label`, and disables Delete when `canDelete` is false (it used to check a `deviceType === "platform"` value the server never stores, and warned as if the last passkey could be deleted). Removed `passkeyService.isPasskeySupported()` and `passkeyService.isPlatformAuthenticatorAvailable()`; call `window.PublicKeyCredential` directly or use `browserSupportsWebAuthn()` from `@simplewebauthn/browser`.

- [`f6a363f`](https://github.com/AshikNesin/groot/commit/f6a363f2d968f893756c723aa7abc4a172d4791f) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One contract for every storage adapter. The semantics (keys, `put`/`head` agreement, missing keys, `list` order, `limit` and `cursor`, `copy`, content types) are written down in `@groot/core/storage/adapter`, and one contract suite runs against the memory, local and R2 adapters.

  - **Breaking:** `StorageAdapter.delete(keys)` resolves to `void` instead of a count. The R2 adapter no longer heads every key before deleting it. Custom adapters: return nothing from `delete`.
  - **Breaking:** `storageService.deleteFiles()` resolves to `void`, and `DELETE /api/v1/storage/files` answers `204` with no body instead of `{ deletedCount }`. `deleteFolder()` and `DELETE /folders/:folderPath` still return `{ deletedCount }`, the number of objects listed under the prefix.
  - **Breaking:** the `groupByDelimiter` helper in `@groot/core/storage/adapter` is replaced by `listKeys(keys, options)`, which also applies `limit` and `cursor`. The memory and local adapters now page like R2 (at most `limit` entries, default and maximum 1000, with a `cursor` when more exist).
  - Fixed: R2 listings carried no content type (the adapter now asks for `httpMetadata`); the local adapter's `head`/`get` now reject a key that escapes the root instead of returning `null`; the local adapter's `put` reports the extension-derived content type it will serve; `memoryStorage().get()` returns a copy of the bytes.

- [`becdce4`](https://github.com/AshikNesin/groot/commit/becdce4363122d09dd588cbb8eea3806be8c8ea7) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The storage HTTP interface is narrowed to what the Storage page uses, and paths are validated once, at the edge.

  - **Breaking:** `POST /api/v1/storage/files/upload` takes one or many files (field `file`, repeated, up to 50) plus an optional `folder`, stores each at `<folder><file name>`, and returns `{ uploadedFiles, failedFiles }`. The `filePath` and `contentType` form fields are gone (the content type comes from the file). Migration: send `folder` instead of a full `filePath`; to store under another name, call `storageService.uploadFile()` from server code.
  - **Breaking:** `POST /files/bulk-upload` is removed (it ignored the folder); use `POST /files/upload`. `storageService.bulkUpload()` is renamed `uploadFiles()`.
  - **Breaking:** `GET /files/metadata` and `storageService.getFileMetadata()` are removed; use `storage.head(key)`.
  - **Breaking:** `GET /files` takes `folder` instead of `prefix` and `delimiter`, and always lists one folder level; the empty-delimiter mode is removed. `storageService.listFiles()` takes `{ folder }`.
  - **Breaking:** file paths with a leading, trailing or doubled `/`, or a `.` / `..` segment, are rejected with `400`, as are upload file names containing `/`. Folder paths are normalised to `a/b/` (a trailing `/` is no longer required on `POST /folders` and `DELETE /folders/:folderPath`), and the schemas are now the only place that checks them: `createFolder()` and `deleteFolder()` no longer reject a path without a trailing `/`, so pass one when calling them directly. The schema module exports `filePathSchema`, `folderPathSchema`, `uploadFilesSchema`, `deleteFolderSchema` and `MAX_UPLOAD_FILES`; `getFileMetadataSchema` is removed.
  - New `parseForm(c, schema)` in `@groot/core/utils/controller.utils` validates a multipart or urlencoded body like `parseBody` does JSON.
  - **Breaking (`@groot/shell`):** `useUploadFile()` is replaced by `useUploadFiles()`, which takes `{ files, folder }` and uploads in one request; `useStorageFiles(folder)` sends `folder`. Multi-file uploads on the Storage page now land in the open folder through the single upload route.

### Minor Changes

- [`869db96`](https://github.com/AshikNesin/groot/commit/869db96397cac115b16c05c4a4e4bf2cbfd5a1cc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - `createApp({ openCorsPaths })` serves public endpoints to any website without credentials (`Access-Control-Allow-Origin: *`), bypassing the app's credentialed CORS allow-list for just those paths. Use it for embeddable widgets and tracking endpoints that customer sites call from their own origin; previously the global middleware answered their preflights first, so setting `CORS_ALLOWED_ORIGINS` silently broke them.

  Exact paths or a `prefix*` (`openCorsPaths: ["/api/track", "/widget/*"]`). Unset, nothing changes.

- [#145](https://github.com/AshikNesin/groot/pull/145) [`29c96e1`](https://github.com/AshikNesin/groot/commit/29c96e120320efe5da8d04bfa75caaeb97a9409a) Thanks [@AshikNesin](https://github.com/AshikNesin)! - `createApp({ uploadPaths })` lets multipart endpoints that enforce their own size caps skip the JSON body limit (1 MB by default) on `/api/*`. Previously only groot's storage upload was exempt, so an app's own upload endpoint (a feedback form with screenshots and recordings, say) was cut off at 1 MB.

  Exact paths or a `prefix*` (`uploadPaths: ["/api/v1/feedback"]`). The storage upload stays exempt; unset, nothing changes.

- [`b3a2a21`](https://github.com/AshikNesin/groot/commit/b3a2a210251e7557517804feda498a711591eeb8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One wire-type source per slice: the server publishes its JSON response types once, and clients import them type-only (erased at build) instead of hand-copying shapes that drift.

  - **`@groot/jobs`**: new `@groot/jobs/server/wire-types` — `Job`, `JobSchedule`, `JobLog`, `JobStats`, `BulkRerunResult`, derived from the schema rows with every timestamp as an ISO string. `@groot/jobs/client/types` re-exports them under the same names, so existing imports keep working.
  - **`@groot/core`**: `SessionUser` (`auth.schema`), `PasskeySummary` with string dates (`passkey.schema`), `FileInfo` with a string `lastModified` plus `UploadFilesResult` (`storage.schema`) and `AppSetting` (`app-settings.schema`) are the single sources, each declared in a zod-only leaf so the client's type graph never pulls in server modules. The passkey service now serialises dates itself, matching what JSON always sent; the service modules re-export their wire types for server-side importers.
  - **`@groot/shell`**: local copies removed — `useStorage`'s `StorageFile`/`UploadResult`, `store/auth`'s `SessionUser`, `services/passkey`'s `Passkey` and `useAppSettings`' `AppSetting` are now aliases of the core types. `@groot/shell` gains a (type-only) `@groot/core` dependency.

  `AGENTS.md` documents the rule: type-only imports across the client/server boundary are allowed for wire types; each slice publishes them once, in a web-neutral leaf module, with dates as ISO strings.

### Patch Changes

- [`1f33ccc`](https://github.com/AshikNesin/groot/commit/1f33cccf00d1074e350194cdb03350fc4544b011) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Job housekeeping costs what it deletes, not what the tables hold.

  - **Once per interval across isolates:** the 10-minute housekeeping gate was an
    in-memory timestamp, so every fresh Workers isolate swept again, up to once
    per cron fire. The last run time now lives in the `jobs:housekeeping:lastRunAt`
    kv row, claimed with one compare-and-set upsert; the in-memory check stays as
    a fast path for the Node poller.
  - **No more orphan-log scan:** `housekeeping()`, `deleteJob()` and
    `purgeJobsByState()` delete the logs of the jobs they remove through the new
    `deleteJobLogs(ids)` (`@groot/jobs/server/logger`, chunked under D1's
    100-parameter limit) instead of `DELETE … WHERE job_id NOT IN (SELECT id FROM
jobs)`, which read every `job_logs` row. A job deleted while its handler runs
    has its late log rows removed when the tick finishes it.
  - **Indexes:** `kv_expires_at_idx` (`@groot/core`) and
    `jobs_state_completed_at_idx` (`@groot/jobs`), in migration
    `0001_housekeeping_indexes.sql`. The Worker applies it on its next first
    request; Node on boot.

  Logs orphaned before this release are no longer swept. To remove them once:
  `DELETE FROM job_logs WHERE job_id NOT IN (SELECT id FROM jobs);`

- [`1f59d1b`](https://github.com/AshikNesin/groot/commit/1f59d1b2190274f9a9cc362049e3ea4b29f26977) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Fixes from the 404less onboarding review:

  - `renameFile` onto its own path no longer deletes the file (it 404s for a missing source, otherwise no-ops).
  - Only the multipart upload route skips the global JSON body limit; the other storage routes keep it.
  - Downloads of HTML/SVG/XML/JS are served as attachments, and every download sends `X-Content-Type-Options: nosniff`, so an uploaded file cannot run script on the app origin.
  - Uploaded file names containing `/` are rejected.
  - `getContentType` no longer resolves `Object.prototype` members (`report.constructor`).
  - `listKeys` rejects limits below 1 instead of returning a silently truncated page.
  - The kv store's prefix match is case-sensitive (`clear("user:")` no longer deletes `User:1`).
  - `parseForm` answers a malformed form body with 400 instead of 500; `verifyPassword` returns `false` for malformed stored hashes instead of throwing.
  - Passkey names are trimmed, so whitespace-only names are rejected.
  - Local (Node) storage writes through a temp file and renames it over the target, so an interrupted overwrite keeps the previous object.

## 1.0.0

### Major Changes

- [#133](https://github.com/AshikNesin/groot/pull/133) [`c1fdac9`](https://github.com/AshikNesin/groot/commit/c1fdac9cc529d7292d9694b79b9b1fbc48df766a) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Rebuild the server on Hono + Drizzle (SQLite only) so the same app runs on Node and on the Cloudflare Workers free plan.

  **Breaking changes**

  - **HTTP layer:** Express is gone. Routers are plain `new Hono<AppEnv>()`; handlers return `ok(c, data, status?)` / `noContent(c)` (`@groot/core/utils/api-response.utils`) and read input with `await parseBody(c, schema)`, `parseQuery(c, schema)`, `parseId(c.req.param("id"))`, `requireUser(c)`. `createRouter`, `handle`, `createServer`, `setupSpaFallback`, `setupErrorHandling`, `startServer` and the Express-typed middlewares no longer exist; use `createApp({ routes })` from `@groot/core/app` and the runtime entries `apps/web/src/server/entry.node.ts` / `entry.worker.ts`.
  - **Database:** Prisma and PostgreSQL support are removed. The schema is Drizzle TypeScript (`packages/core/src/database/schema.ts`, `packages/jobs/src/server/schema.ts`, `apps/web/src/server/db/schema.ts`), `db` comes from `@groot/core/database` and is set by `bootstrap()`, migrations are generated with `pnpm db:generate` into `apps/web/drizzle/` and applied on boot (Node) or with `pnpm db:migrate:worker` (D1). Table and column names changed (`users`, `passkeys`, `todos`, `kv`, `jobs`, `job_schedules`, `job_logs`, snake_case columns): existing databases need a fresh migration or a one-off data copy.
  - **Jobs:** pg-boss and honker are replaced by a table-backed queue. `JobQueueAdapter`, `initJobQueue`, `getJobQueue`, the adapter subpaths, `controller` and `error-handler` are removed. Jobs are `Job` rows with camelCase fields (`runAt`, `startedAt`, `completedAt`, `retryLimit`, `retryCount`, `retryDelay`, `output`, `error`, `singletonKey`) and five states (`created`, `active`, `completed`, `failed`, `cancelled`). Handlers receive `{ id, name, data, attempt, logger }` and may return an output value. Schedules are one per job name (no `key`). `runTick()` drives the queue: polled on Node (`startWorkers()`), cron trigger on Workers, and inline after `addJob()`.
  - **Config and env:** `config.yml`, the YAML loader and varlock are removed. Configuration is `defineConfig()` in `apps/web/src/server/config.ts` on top of `defaultConfig(env)` (`@groot/core/config`); environment variables are validated by the Zod schema in `@groot/core/env` and documented in `.env.example`. Development needs no `.env`; production requires `JWT_SECRET_KEY`, `ADMIN_AUTH_KEY`, `ORIGIN` and `RP_ID`.
  - **Auth:** passwords are hashed with PBKDF2-SHA256 (WebCrypto) instead of bcrypt, JWTs are issued with `jose`. Existing bcrypt hashes are not accepted; users must reset their passwords.
  - **KV:** Keyv is replaced by the `kv` table (`kv`, `createNamespaceKv`, `purgeExpiredKv` in `@groot/core/kv`) with a slightly different API (`list(prefix)`, `clear(prefix)`).
  - **Logger:** pino is replaced by a small structured logger with the same call shape (`logger.info(data, msg)`, `.child()`); `createRequestLogger` now takes a plain descriptor and request context lives in `@groot/core/context`.
  - **Storage:** the files-sdk adapter is injected through `bootstrap({ storage })`: `localStorage()` on Node, `r2Storage(env.STORAGE)` on Workers. `STORAGE_DRIVER` and the bundled S3 adapter are gone (pass `files-sdk/s3` yourself if you need it).
  - **Build output:** the client builds to `dist/client` and the Node bundle to `dist/server/bundle.js`; `pnpm start` migrates on boot (no `prestart`).

  **New**

  - Cloudflare Workers target: `wrangler.jsonc` (D1, R2, Static Assets, one cron trigger), `pnpm dev:worker`, `pnpm check:worker`, `pnpm deploy:worker`, `docs/guides/deploy-cloudflare.md`.
  - Zero-config local development (`pnpm dev` with no `.env`), `pnpm db:studio`, `pnpm db:seed`.

### Minor Changes

- [#139](https://github.com/AshikNesin/groot/pull/139) [`b89d44b`](https://github.com/AshikNesin/groot/commit/b89d44b150dea6c256cf1c8331f5d5792d0ffd4d) Thanks [@AshikNesin](https://github.com/AshikNesin)! - **Production state defaults to one `/data` volume.** With `NODE_ENV=production` and no `DATABASE_URL`, the Node runtime now opens `file:/data/prod.db` (`defaultDatabaseUrl()` in `@groot/core/env`; development keeps `file:./data/dev.db`). Before, production silently fell back to `./data/dev.db` inside the app directory. Set `DATABASE_URL` to keep an existing path.

  `bootstrap({ storage })` also accepts a factory that receives the validated env, and `uploadsRoot(env)` (`@groot/core/storage/node`) puts production uploads in `/data/uploads` (next to the database), so the Node entry no longer writes them to `./local/uploads` under the app directory, where a redeploy wipes them. `UPLOADS_DIR` overrides the location. Move existing files into the new folder if you used local uploads in production.

- [#135](https://github.com/AshikNesin/groot/pull/135) [`6002a46`](https://github.com/AshikNesin/groot/commit/6002a46dabe53ab067472cfa03862d18e1d9fcdc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - **@groot/shell:** the API client is now plain `fetch`; axios is gone. `apiClient.client` (the axios instance) no longer exists, and failed requests throw `ApiError` (`status`, `code`, `details`, `url`) instead of an axios error. `error.message` still carries the server's message.

  **@groot/core:** `migrateD1()` applies Drizzle's generated SQL migrations to a D1 database from inside the Worker (wrangler-compatible `d1_migrations` bookkeeping), so the Workers entry migrates on its first request and `wrangler deploy` is the whole deploy. `pnpm db:generate` now also writes `apps/web/drizzle/index.ts`, the list the Worker imports. The unused `send-push-notification` dependency is dropped.

### Patch Changes

- [#134](https://github.com/AshikNesin/groot/pull/134) [`1ae96c1`](https://github.com/AshikNesin/groot/commit/1ae96c1e85afd0c0d2562958589b2ee2f08bacf8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Malformed passkey attestation or assertion data now returns 400/401 with the verifier's message instead of a 500.

## 0.10.3

### Patch Changes

- [`2c06f72`](https://github.com/AshikNesin/groot/commit/2c06f72266b4edf9a9eaa35a1ad3814155d6d730) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Rate-limit login attempts and compare admin keys in constant time.

- [`ae93587`](https://github.com/AshikNesin/groot/commit/ae93587bec63fcdab1f0885e92ff7b990294802d) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add an optional `readiness` probe to `createServer` so apps can gate /health and /ready on async boot work (e.g. an agent store resuming after restart).

- [`9afae1d`](https://github.com/AshikNesin/groot/commit/9afae1d6d901ed02f0b3c82ddcd6c781229ca636) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Remove Doppler from secrets management. Secrets resolve from real
  environment variables only (hosting platform env vars or a git-ignored
  .env file): drop the @varlock/doppler-plugin, the DOPPLER_TOKEN item and
  all doppler() resolvers from .env.schema — production secrets that are
  unset now fail validation with a clear message instead of a Doppler auth
  error. Setup script and docs updated to match.

- [`84f82a9`](https://github.com/AshikNesin/groot/commit/84f82a9ec4c54aab0b005c495f7bd14b4d46b9db) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Skip compression for server-sent event responses so streaming stays immediate.

## 0.10.2

### Patch Changes

- [#126](https://github.com/AshikNesin/groot/pull/126) [`09fea32`](https://github.com/AshikNesin/groot/commit/09fea322f9fa0c12397d8dccbc88638612dd99ca) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Make migration ownership checkable: add `pnpm check:schema` (SQLite honker diff and Postgres pg-boss containment), a boot-time provider assertion in `@groot/core` that fails fast when the generated Prisma client's engine contradicts `DATABASE_URL`, and remove the dead `DATABASE_ENGINE` selectors in favor of `DATABASE_URL` plus `pnpm prisma generate`.

## 0.10.1

### Patch Changes

- [`81cfc6d`](https://github.com/AshikNesin/groot/commit/81cfc6d9797f3d51d6b79555ac933d1eebacb83a) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Upgrade Prisma ORM from 7.8.0 to 7.10.0 (prisma CLI, @prisma/client, @prisma/adapter-pg, @prisma/adapter-better-sqlite3)

  7.9/7.10 are fix-and-feature releases within the 7.x line — no code changes were required (schema, prisma.config.ts, driver-adapter wiring, and generated-client imports all unchanged). Notable fixes that land with the bump: unique-constraint violations from nested writes now report the right `modelName` (P2002) including `@@map`/`@@schema` models, batched `findUniqueOrThrow()` misses correctly reject with P2025, parameter-chunked statements execute atomically with rollback, `@prisma/adapter-better-sqlite3` maps the full `SQLITE_BUSY` family to typed errors, and `@prisma/adapter-pg` preserves constraint names in P2002 errors. Also relevant to this repo: the `prisma generate` opt-in agent-skills prompt is skipped in npm lifecycle scripts (this repo generates via `postinstall`), and the transitive `fast-uri` audit advisory is patched.

  `pnpm-workspace.yaml` adds a one-line `trustPolicyExclude` for `prisma@7.10.0`: that release was published without an npm provenance attestation after a broken publish-token incident on Prisma's side (see the `7.10.0-integration-fix-prisma-publish-token` dist-tag), which trips this repo's `trustPolicy: no-downgrade` guard. Verified benign — official `latest` tag, matching git tag and release notes, registry signatures intact — and scoped to that exact version so the exclusion dies with the next release.

- [`bb4e94d`](https://github.com/AshikNesin/groot/commit/bb4e94d544ce23d4e8fe35411ff2fcc72bec4c3c) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(settings): session-authorize app settings writes — the UI write path was dead code

  `PUT`/`DELETE /api/v1/settings/:key` required an `x-admin-auth-key` header that the browser client never sends, so every signed-in user clicking "Add Setting", "Save changes", or "Delete" received a 401 — and the axios 401 interceptor then cleared their session and bounced them to `/login`. Writes are now authorized by the session (the router already mounts behind `jwtAuthMiddleware`), matching the settings UI that has always shipped. The admin key remains reserved for machine endpoints (`POST`/`GET /auth/users`).

  Covered by an e2e round trip: create → edit description + JSON → save → full reload → persisted → delete via confirm dialog.

- [`9477a61`](https://github.com/AshikNesin/groot/commit/9477a61b24c2f2d722ceb476cba652c34af96acb) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(storage): prune emptied directories after folder delete on the local driver

  `deleteFolder` removed every object under the prefix, but the fs adapter leaves the now-empty directories on disk — `local/uploads` accumulated empty husks forever. Invisible in the UI (listings are file-driven) but a real disk leak; S3 has no on-disk directories so it was unaffected. The service now walks the deleted prefix bottom-up after the batch delete and `rmdir`s emptied directories, with a containment guard so a crafted folder path can never escape the uploads root.

  The uploads root moved to a shared `LOCAL_UPLOADS_ROOT` constant (`storage/files.ts`) so the adapter config and the prune can't drift apart. Regression-locked by unit tests (nested folder prune, trailing-slash validation) and an on-disk assertion in the storage e2e folder-lifecycle test.

## 0.10.0

### Minor Changes

- [`9e5602a`](https://github.com/AshikNesin/groot/commit/9e5602a68d11df36357165df982f71cb8d6c2a79) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat: restore child-project primitives removed by the v2.6.0 dead-code audit

  The v2.6.0 simplification pass verified "zero importers" via the in-repo
  import graph — the right bar for app code, the wrong bar for a boilerplate's
  shipped surface. Child projects (nesins-finance being the reference fork)
  consumed these within months of forking, and their removal forces every
  consumer to vendor copies that then drift. Restored on proven child-project
  demand:

  - `@groot/ui`: `alert`, `select`, `pagination`, `tooltip` primitives and
    barrel exports (select alone had 30 importers in the first child project).
    The barrel now documents that this package is the component kit shipped to
    child projects — absence of in-repo importers is not dead code.
  - `@groot/core/logger`: `logPerformance` (duration-escalating performance
    record) and the breadcrumb subsystem (`addBreadcrumb` /
    `getBreadcrumbs` / `clearBreadcrumbs`, context wiring, `buildErrorContext`
    attachment) — used by child projects' job and ingestion instrumentation.
  - `@groot/core/storage`: `copyFile` (404-guarded object duplication for
    workflow/template-style derived files).

  `@groot/jobs` worker now emits a `logPerformance` record per completed/failed
  job (real in-repo consumer; slow jobs escalate to `warn` at >5s), and each
  restored surface ships with tests: breadcrumbs (context isolation, 50-cap),
  logPerformance (level escalation, record shape), copyFile (happy path, 404,
  independence), and Alert/Select/Pagination/Tooltip component tests.

  Not restored (no child-project demand, pure aliases): `createLogger` (use
  `logger.child`), `parseLimit`, the storage DTO type aliases, and the 16
  date helpers removed from `@groot/shell/lib/date.utils`.

## 0.9.0

### Minor Changes

- [`18e3200`](https://github.com/AshikNesin/groot/commit/18e3200e3a34db550672c49aa2c5683a4f261b11) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Codebase simplification pass — dead code, duplication, API surface

  Audit-driven cleanup, no behavior changes. Verified green across every layer: typecheck, lint, 211 unit tests, full build, 6 e2e tests. All removals were verified to have zero real consumers via import-graph resolution.

  Dead code (~1,300 LOC across 22 files):

  - date/shell lib helpers with zero callers (25→9 date fns; dropped `formatCurrency`, `debounce`, `truncate`, `getInitials`)
  - one-line Prisma pass-throughs in auth/passkey services; never-wired `auth.deleteUser`, `storage.copyFile`, 6 storage DTO aliases
  - vestigial breadcrumb subsystem (zero `addBreadcrumb` callers), dead `createLogger`/`logPerformance`/`parseLimit`/`useBulkUpload`/`todoJobOptions`
  - 4 orphan ui primitives: `alert`, `pagination`, `select`, `tooltip` (423 lines, zero real importers)

  Duplication:

  - The jobs client `Job`/`ScheduledJob` types now alias the server adapter's `QueueJob`/`ScheduledJobInfo` instead of maintaining a second drifting 19-field shape
  - `withJobToast` helper replaces 15 identical try/toast/catch blocks in `useJobs`/`useJobDetail`
  - `TextInputDialog` consolidates the CreateFolder/Rename dialogs

  Also fixes pre-existing breaks on main: the job-logger level gate was typed `pino.LevelWithSilent` (root tsc exited 2), the pretest hook resolved the DEV database when NODE_ENV wasn't set (now `NODE_ENV=test` everywhere; `ensure-test-db.ts` refuses to run when `TEST_DATABASE_URL` is unset), and login + todos e2e specs drifted from the UI copy.

### Patch Changes

- [`18e3200`](https://github.com/AshikNesin/groot/commit/18e3200e3a34db550672c49aa2c5683a4f261b11) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Guard optional S3 env vars in the storage adapter and typecheck fixes

  `packages/core/src/storage/files.ts` now throws a clear error when `STORAGE_DRIVER=s3` but `AWS_DEFAULT_S3_BUCKET` is unset (the vars are optional in env.d.ts, so this previously failed later with a confusing adapter error), and defaults `AWS_REGION` to `us-east-1` when unset. Also: `dialog.tsx` outside-click handlers typecheck cleanly, and `railpack.json` + `config.example.yml` are now part of the boilerplate sync patterns (the live `config.yml` stays project-owned).

## 0.8.1

### Patch Changes

- [`cc632b9`](https://github.com/AshikNesin/groot/commit/cc632b982912b5d9261bfd268813ed25a30ef395) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(core): add `copyFile` storage helper

  Mirrors the existing `renameFile` util but uses `files.copy()` so the source
  is preserved. Throws `Boom.notFound` when the source key does not exist,
  matching `renameFile` semantics.

## 0.8.0

### Minor Changes

- [`c097350`](https://github.com/AshikNesin/groot/commit/c0973502ae2e731094876e05dcfc9b3db6b3ccfc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Database engine is now inferred from the `DATABASE_URL` scheme (`postgresql://` → Postgres, `file:` / bare path → SQLite) instead of a separate `DATABASE_ENGINE` env var. The old knob is removed from `.env.schema`; existing consumers that relied on `DATABASE_ENGINE` should delete it (the scheme now drives `dbEngine`, `isPostgres`, and `isSqlite` everywhere).

- [`c097350`](https://github.com/AshikNesin/groot/commit/c0973502ae2e731094876e05dcfc9b3db6b3ccfc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Storage adapter is now selected by `STORAGE_DRIVER` (`local` | `s3`, default `local`) instead of branching on `NODE_ENV`. The local filesystem adapter is now valid in every environment, including production single-node deployments; S3 is only loaded when explicitly selected. AWS credentials are no longer marked `@required` in `.env.schema` — they apply only when `STORAGE_DRIVER=s3`.

## 0.7.1

### Patch Changes

- [`b0a391b`](https://github.com/AshikNesin/groot/commit/b0a391b85274ab8cf2f6837b8dda4dadf6f716a1) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Rename `*.validation.ts` to `*.schema.ts`

  These files contain only Zod schemas, not validation logic, so the
  naming was misleading. Renamed `auth`, `passkey`, `app-settings`,
  `storage`, and `todo` validation files to `*.schema.ts` and updated
  all imports across `@groot/core`, `@groot/web`, the docs, and
  `AGENTS.md`. This is a pure rename — no behavior change.

## 0.7.0

### Minor Changes

- [#77](https://github.com/AshikNesin/groot/pull/77) [`e0d78f5`](https://github.com/AshikNesin/groot/commit/e0d78f5d17c27df512cd53ec20277ffdc9cf19bb) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - feat: dual database engines (SQLite default, PostgreSQL opt-in) + job-queue adapter

  The boilerplate now runs on **SQLite by default** and **PostgreSQL as an opt-in**
  via `DATABASE_ENGINE`, with the background job queue running on a matching
  engine-specific adapter. Application code is engine-agnostic.

  ## @groot/core

  - **Engine selection.** `DATABASE_ENGINE=sqlite` (default) uses
    [better-sqlite3](https://github.com/WiseLibs/better-sqlite3);
    `DATABASE_ENGINE=postgres` uses PostgreSQL via `@prisma/adapter-pg`. The
    driver adapter, the KV backend, and the job queue are all selected by this
    single switch.
  - **Two Prisma schemas kept in parity.** `apps/web/prisma/schema.sqlite.prisma`
    and `apps/web/prisma/schema.postgres.prisma` (Prisma requires a literal
    `provider`). A unit test (`tests/server/prisma/schema-parity.test.ts`)
    guards that the two stay in sync.
  - **`Json` columns on both engines.** Array/JSON fields use Prisma's `Json`
    type — native `JSONB` on Postgres, `TEXT` on SQLite — so the generated client
    types are identical (`runtime.JsonValue`) and there is zero app-code
    branching.
  - **KV backend follows the engine.** Keyv now uses `@keyv/sqlite` on SQLite
    and `@keyv/postgres` on Postgres (was Postgres-only).
  - **Generated client is engine-specific.** The generated Prisma client embeds
    the datasource provider, so switching engines requires regenerating it.
    `pnpm dev` / `pnpm test` (via the `pretest` hook) now regenerate for the
    active engine.

  ## @groot/jobs

  - **Job-queue adapter pattern.** A new `JobQueueAdapter` interface
    (`packages/jobs/src/server/adapter.ts`) captures the operations the rest of
    `@groot/jobs` needs. `client.ts` picks the implementation by engine:
    - **Postgres** → `PgBossAdapter` wraps [pg-boss](https://github.com/timgit/pg-boss).
    - **SQLite** → `HonkerAdapter` wraps
      [`@russellthehippo/honker-node`](https://github.com/russellromney/honker), a
      durable SQLite-backed queue with retries, visibility timeouts, dead-letter
      rows, and cron scheduling.
  - **Normalized job shape.** Both adapters return jobs in a shared `QueueJob`
    shape; feature handlers take a `JobContext<T>`. No `pg-boss` import remains in
    app code, and the dashboard is engine-agnostic.
  - New dependency: `@russellthehippo/honker-node` (SQLite engine only).

  ## groot (app)

  - **SQLite is the default engine.** `DATABASE_ENGINE` defaults to `sqlite`;
    set `DATABASE_ENGINE=postgres` to opt into PostgreSQL.
  - **Dual-engine CI.** `.github/workflows/test.yml` runs the full suite
    (typecheck, lint, test, build) on both engines via a matrix — Postgres leg
    uses a `pgvector/pgvector:pg18` service container. Convenience scripts:
    `pnpm test:sqlite`, `pnpm test:postgres`, `pnpm test:all`.
  - **Build.** Native modules (`better-sqlite3`, `sqlite3`, `pg`,
    `@russellthehippo/honker-node` + platform packages) are externalized in
    `scripts/build.mjs`.
  - **Docs.** New `docs/database-engines.md`; setup, quick-start, architecture,
    jobs, KV, testing, and migration guides updated for both engines.

  See `docs/database-engines.md` for the full engine matrix, the `Json` parity
  strategy, honker specifics, and migration/build gotchas.

## 0.6.1

### Patch Changes

- [#73](https://github.com/AshikNesin/groot/pull/73) [`40eb1ec`](https://github.com/AshikNesin/groot/commit/40eb1ece15b0b3c299b32f12763f2c7be4ff25d0) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - perf: reduce memory consumption across the stack

  - **Connection pools**: Prisma now uses an explicit `pg.Pool` (`max=5` dev / `max=10` prod, `idleTimeoutMillis=30s`) instead of letting PrismaPg silently create an uncapped pool. KeyvPostgres pool capped at `max=2`. Combined with the PgBoss fix this cuts idle PostgreSQL connections from ~30 to ~6.
  - **Logger**: removed the custom `serializeObject()` + `dayjs()` call from pino's `log` formatter. Every log line was running a 5-level deep recursive object traversal — pino already serialises objects natively, making this pure overhead.
  - **Prisma query events**: `{ level: "query", emit: "event" }` is now only registered in development where the DB-query logger subscribes to it. In production the event listener overhead was paid on every query for nothing.
  - **Body parser limits**: reduced `express.json` / `express.urlencoded` from `50mb` → `1mb`. The 50 MB limit caused `raw-body` to pre-allocate a 50 MB buffer for every incoming request regardless of payload size.
  - **Compression**: added `threshold: 1024` so responses under 1 KB are sent uncompressed, avoiding wasteful CPU on tiny JSON payloads.
  - **S3 adapter lazy-load**: `files-sdk/s3` (which eagerly imports all three `@aws-sdk/*` packages) is now dynamically imported only in production. In development the local-fs adapter is used and `@aws-sdk` never loads.
  - **lodash.mergewith removed**: replaced with a 25-line native `mergeWith()` in `object.utils.ts`. The package was loaded at every boot solely for a one-time config merge.
  - **`@sentry/profiling-node` removed**: was listed as a dependency but never imported anywhere in the codebase — pure dead weight.

## 0.6.0

### Minor Changes

- [#71](https://github.com/AshikNesin/groot/pull/71) [`86c1657`](https://github.com/AshikNesin/groot/commit/86c165721799f81f001ea8f3c986ffc984551b4e) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Flatten API feature modules: merge controller handlers into routes, fold model layer into services, remove index.ts barrels. Each feature is now 3-4 files: routes, service, validation, (optional) jobs.

## 0.5.0

### Minor Changes

- [#69](https://github.com/AshikNesin/groot/pull/69) [`0c47508`](https://github.com/AshikNesin/groot/commit/0c47508c31623b46f051257048c19f7c86c89e2b) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor(core): migrate backend validation from middleware to strictly-typed controller helpers

  Replaced the `validateBody`, `validateQuery`, and `validateParams` Express middlewares with inline controller helpers `parseBody`, `parseQuery`, and `parseParams`. This change improves type safety by directly leveraging `z.output<typeof Schema>` inside the controllers, eliminating the need for unsafe `as T` casting.

  - The `req.validated` property has been removed from the Express Request type.
  - All core and shared feature modules (auth, passkey, storage, jobs, settings) have been migrated.

## 0.4.1

### Patch Changes

- [`5f9eddd`](https://github.com/AshikNesin/groot/commit/5f9eddd7bba05222c378578a7d0900dac53d52a2) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: unify cross-package imports on @groot/\* aliases

  Standardizes import style so cross-directory imports always use the
  package alias (`@groot/core/*`, `@groot/shell/*`, `@groot/jobs/*`) while
  same-directory imports stay relative (`./`). Previously these were mixed —
  even within a single file (e.g. `../kv` next to `@groot/core/logger`) —
  making import style inconsistent across the codebase.

  ## @groot/core

  - Converted all cross-directory `../` imports to `@groot/core/*` aliases
    across `ai`, `auth`, `config`, `kv`, `middlewares`, `notification`,
    `passkey`, `settings`, `storage`, and `utils`.
  - Same-directory `./` imports left unchanged.
  - Prisma `../../generated/prisma/client` imports in `database/` kept
    relative (no alias maps to the generated output outside `src/`).

  ## @groot/shell

  - Converted cross-directory `../` imports to `@groot/shell/*` aliases
    across `components`, `hooks`, `lib`, `pages/storage`, `services`, and
    `store`.

  ## @groot/jobs

  - Converted cross-directory `../` imports to `@groot/jobs/client/*`
    aliases across the client `components/`.

## 0.4.0

### Minor Changes

- [`83b3a6f`](https://github.com/AshikNesin/groot/commit/83b3a6f1ce34a28299b00f18645faabf3e9569a8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: unify API client, form handling, and server response flow

  A cross-cutting refactor of how the frontend talks to the API and how
  controllers shape responses, plus a shared Form primitive.

  ## @groot/core

  - Removed the `*System` namespace barrels (`AISystem`, `AuthSystem`,
    `ErrorSystem`, `KVSystem`, plus the passkey/settings/storage equivalents).
    Callers now use direct named imports instead of convenience namespaces.
  - Added `utils/controller.utils.ts` with `requireUser(req)` and
    `validatedBody<T>(req)` helpers, replacing repeated inline `req.user` /
    `req.body as` boilerplate across controllers.
  - Added `utils/api-response.utils.ts` to standardize controller response
    shapes.
  - Extracted shared Zod field shapes (`emailField`, `passwordField`) in
    `auth.validation.ts` so the client can reuse them for form validation
    (single source of truth).
  - Streamlined `error-handler`, `error-response`, `route-handler`, and
    `validation` middlewares.

  ## @groot/ui

  - Added a `Form` component (`form.tsx`) with `react-hook-form` integration and
    field helpers.

  ## @groot/shell

  - Reworked `lib/api.ts` (the `apiClient`) for simpler, more consistent request
    handling.
  - Added `useToastMutation` hook to standardize mutation + toast feedback.
  - Refactored `Login`, storage dialogs (`CreateFolderDialog`, `RenameDialog`),
    `PasskeyManager`, `AppSettings`, and the `useStorage` / `useAppSettings`
    hooks to build on the new Form component and apiClient.

  ## @groot/jobs

  - Refactored the client API layer (`api.ts`), `useJobs`, `useJobDetail`, and
    `JobsTable` to align with the new apiClient patterns.

## 0.3.0

### Minor Changes

- [#64](https://github.com/AshikNesin/groot/pull/64) [`ae54b49`](https://github.com/AshikNesin/groot/commit/ae54b4920f39b2dbd9432298855210cb4752cd57) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: reorganize codebase architecture

  - Flattened the `packages/` directory, merging `server`, `logger`, and `database` into `core`.
  - Renamed `client` to `shell`.
  - Moved boilerplate `auth`, `settings`, and `storage` modules out of `apps/web/src/client/pages` and into `@groot/shell`.
  - Replaced all legacy paths with their new equivalents in all codebase documentation, tests, and comments.

## 0.2.0

### Minor Changes

- [`07de4af`](https://github.com/AshikNesin/groot/commit/07de4afce92948ac8a657284548d21fb7a670910) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Extract logger into a dedicated `@groot/core/logger` package

  The Pino logger module moves out of `@groot/core/core/logger/` into its own
  flat `@groot/core/logger` package (mirrors `@groot/core/database` as a leaf). This removes
  the `@groot/jobs` → `@groot/core` reach-through for logger exports and gives
  foundational infrastructure its own package boundary.

  **Breaking — migration required for downstream repos:**

  - All `@groot/core/core/logger` imports must move to `@groot/core/logger`. Affected
    surfaces: server middlewares, kv store, shared services, the jobs backend,
    the app bootstrap, and tests that `vi.mock` the logger.
  - The logger no longer reads `env`/`config` eagerly. The server bootstrap must
    call `configureLogger({ level, service, nodeEnv })` once before request
    handling — `apps/web/src/server/index.ts` now does this as the first statement
    in `main()`:
    ```ts
    import { configureLogger } from "@groot/core/logger";
    configureLogger({
      level: config.logging.level,
      service: config.app.name,
      nodeEnv: env.NODE_ENV,
    });
    ```
    This preserves the `config.logging.level` / `config.app.name` YAML knobs.
  - `loggerConfig` / `logLevel` are now live bindings updated by `configureLogger`
    (read them at runtime, not import time). `isDevelopment` reads `process.env.NODE_ENV`
    directly (equivalent to the previous `env.NODE_ENV`).

  Notes:

  - `@groot/core/logger` is a leaf (deps: `pino`, `pino-pretty`, `dayjs`; `@types/express`/`@types/node` dev). No `@groot/*` deps.
  - `@groot/core`, `@groot/jobs`, and `apps/web` now declare `@groot/core/logger` as a workspace dependency.
  - `@groot/core` no longer contains the logger module; the `packages/core/src/logger/` directory is removed.
  - Configured via the esbuild/vitest/tsconfig `@groot/core/logger` alias.

### Patch Changes

- Updated dependencies [[`07de4af`](https://github.com/AshikNesin/groot/commit/07de4afce92948ac8a657284548d21fb7a670910)]:
  - @groot/core/logger@0.1.0

## 0.1.0

### Minor Changes

- [#60](https://github.com/AshikNesin/groot/pull/60) [`0473401`](https://github.com/AshikNesin/groot/commit/0473401aacc5ccd4e67e8def92e98b30ecd72a9a) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Extract all jobs code into a dedicated `@groot/jobs` package

  The entire jobs vertical — pg-boss backend infrastructure, HTTP admin API,
  job logger, the dashboard UI, client types, and API methods — now lives in a
  single `@groot/jobs` package with two flat entry points:

  - `@groot/jobs/server/*` — pg-boss queue/worker/queries, routes, job logger
  - `@groot/jobs/client/*` — dashboard UI, `jobsApi`, types

  Business-specific handlers (`todo.jobs.ts`) and bootstrap wiring stay in
  `apps/web/`. This consolidates jobs code that was previously spread across
  `@groot/core` (`core/job`, `shared/jobs`, `core/logger`), `@groot/shell`
  (`types/jobs`, apiClient methods), and `apps/web` (dashboard UI).

  **Breaking — migration required for downstream repos:**

  - `createJobLogger` / `JobLogStream` / `createJobLogStream` moved from
    `@groot/core/core/logger` → `@groot/jobs/server/logger`. The
    `@groot/core/core/logger` re-exports are removed.
  - The 17 job methods were removed from `apiClient` (`@groot/shell/lib/api`).
    Use `jobsApi` from `@groot/jobs/client` instead.
  - `JobName` changed from an enum (with hardcoded `TODO_*` values) to
    `type JobName = string`. App-specific job names live with their handlers.
  - Server-side imports of job infra must move from
    `@groot/core/core/job/*` and `@groot/core/shared/jobs/*` to
    `@groot/jobs/server/*` (use explicit subpaths like `/worker`, `/logger`,
    `/routes` for the server bundle).
  - The jobs dashboard UI moved from `apps/web/src/client/pages/jobs/` to
    `@groot/jobs/client`. Import pages via `@groot/jobs/client`.

  The `database → logger → job-stream → database` module cycle is resolved as
  a side effect (job-stream left `@groot/core/core/logger`). `pg-boss` is no
  longer a dependency of `@groot/core` (it now lives in `@groot/jobs`).
