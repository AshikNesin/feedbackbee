# Testing

Vitest (through Vite+) for server and client tests, Playwright for end to end.
Server tests never start an HTTP server: the Hono app is called in-process with
`app.request()` against an in-memory SQLite database.

## Commands

```bash
pnpm test           # server tests, single run
pnpm test:watch     # server tests, watch mode
pnpm test:client    # client tests (jsdom)
pnpm test:all       # both
pnpm test:e2e       # Playwright (starts the dev server itself)
```

## Server test setup

`tests/server/setup.ts` runs once per test file and boots the app through the
same `startWebApp()` as the entries, with:

- `NODE_ENV=test`, `DATABASE_URL=":memory:"`, `LOG_LEVEL=silent`
- `openDatabase(":memory:")`: a fresh database per file with every migration applied
- `memoryStorage()` for uploads
- `jobs.enabled = false` (a `NODE_ENV=test` default), so nothing runs in the
  background; tests call `runTick()` when they want jobs processed

Files are isolated from each other for free. Within a file, clear what you
need in `beforeEach` (e.g. `await db.delete(todos)`, `jobRunner.reset()`).

## Helpers (`tests/server/helpers.ts`)

| Helper                                             | Does                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTestApp(options?)`                          | `createWebApp()` — the real app with every router and rate-limit counters of its own. Pass `clientAddress` (a resolver such as `(c) => c.req.header("x-test-peer")`) to say who each request is from instead of faking a socket |
| `setAppConfig(overrides?)`                         | The app's config with `overrides` on top; call it bare to restore. A bare `setConfig()` would drop the app's own overrides                                                                                                      |
| `api(app, path, { method, json, token, headers })` | Sends the request, returns `{ status, headers, body }`; `body` is the envelope, a 204 yields `{ success: true }`                                                                                                                |
| `signIn(app)`                                      | Creates a unique user and logs in; returns `{ token, user, email, password, cookie }`                                                                                                                                           |
| `adminHeaders()`                                   | `{ "x-admin-auth-key": env.ADMIN_AUTH_KEY }`                                                                                                                                                                                    |

## Layout

```
tests/
├── server/
│   ├── setup.ts · helpers.ts
│   ├── core/      # @groot/core units: env, config, logger, kv, storage adapters, D1 migrator, …
│   ├── jobs/      # @groot/jobs/server: queue + tick, schedules, housekeeping, routes, job logger
│   ├── api/       # HTTP tests through the routers: auth, passkey, settings, storage, todos
│   ├── app/       # app-owned: createApp, todo jobs (project-local, not synced)
│   ├── checks/    # repo guards: changesets, kit exports, typecheck coverage, lint rules, doc refs, migrations, rule table
│   ├── groot/     # sync tooling
│   ├── ai/        # @groot/ai
│   └── scripts/   # build scripts (runtime closure)
├── client/        # jsdom + testing-library (configured in vite.config.ts)
├── e2e/           # Playwright specs + global-setup.ts
└── kit-consumers/ # compiled fixture for pnpm typecheck:kit (never executed)
```

`tests/server/setup.ts`, `tests/server/{core,jobs,api,groot,ai}` and `tests/client`
sync with the source they exercise (`TEST_AREA_OWNERSHIP` in
`.groot/lib/patterns.ts`); `tests/server/app` and `tests/e2e` stay project-local.

`pnpm typecheck` compiles every test with the code it tests: `tsconfig.json`
includes `tests/server`, `apps/web/tsconfig.json` includes `tests/client`, and
`tests/e2e/tsconfig.json` covers the Playwright specs. A wrong import or a
missing argument in a test fails there, before the suite runs.

## Patterns

### An API test

```ts
import { describe, expect, it } from "vite-plus/test";
import { api, createTestApp, signIn } from "../helpers";

const app = createTestApp();

describe("todos API", () => {
  it("creates, reads and deletes", async () => {
    const { token } = await signIn(app);
    const created = await api<{ id: number }>(app, "/api/v1/todos", {
      method: "POST",
      json: { title: "Write tests" },
      token,
    });
    expect(created.status).toBe(201);
    const id = created.body.data!.id;
    expect((await api(app, `/api/v1/todos/${id}`, { method: "DELETE", token })).status).toBe(204);
    expect((await api(app, `/api/v1/todos/${id}`, { token })).status).toBe(404);
  });

  it("rejects an invalid payload", async () => {
    const { token } = await signIn(app);
    const res = await api(app, "/api/v1/todos", { method: "POST", json: { title: "" }, token });
    expect(res.status).toBe(400);
    expect(res.body.error?.details).toMatchObject({ title: [expect.any(String)] });
  });
});
```

### A job test

```ts
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { db } from "@groot/core/database";
import { addJob, jobRunner, jobs, registerJobHandler, runTick } from "@groot/jobs/server";

beforeEach(() => jobRunner.reset());

it("runs a job and stores its output", async () => {
  registerJobHandler<{ n: number }>("double", (job) => ({ doubled: job.data.n * 2 }));
  const id = await addJob("double", { n: 21 });
  expect(await runTick()).toMatchObject({ claimed: 1, completed: 1 });
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  expect(row).toMatchObject({ state: "completed", output: { doubled: 42 } });
});
```

### An admin route

```ts
const res = await api(app, "/api/v1/auth/users", {
  method: "POST",
  headers: adminHeaders(),
  json: { email: "new@example.com", password: "a-long-password" },
});
expect(res.status).toBe(201);
```

### Services and units

Call them directly; the database is real, so there is nothing to mock
(`tests/server/core/kv.test.ts`, `tests/server/jobs/queue.test.ts`). Reach for
`vi.mock` only for external services.

### A client component

Render it the way `main.tsx` mounts the app: a client from
`createShellQueryClient({ queries: { retry: false } })` in a
`ShellQueryProvider`, and `GrootUIProvider` for confirmations and toasts. Stub
`fetch` with `vi.stubGlobal` rather than mocking `apiClient`, so the envelope,
`ApiError` and the error wording are the real ones, and assert on the toast
text a person reads (`tests/client/components/shell/AppSettings.test.tsx`,
`tests/client/lib/query-client.test.tsx`).

### Dates and time

Both setup files call `pinClockWhileLoadingAndBeforeEachTest()` from
`tests/test-clock.ts`. It runs `vi.setSystemTime(FIXED_NOW)` when the setup
loads and again before every test, so `Date` reports `FIXED_NOW` on any real
day and does not tick. That covers a test file's module scope too,
such as a token minted at the top of the file. Only `Date` is faked:
`setTimeout`, `setInterval` and `performance.now()` stay real.

- A fixture that must lie in the future uses `futureIso(days)`, never a date
  literal. A literal passes on the day it is written and fails once the real
  clock passes it. Against the frozen clock it gives the same result on any
  day.
- A test that needs another instant calls `vi.setSystemTime(...)` in its body.
  The next test starts at `FIXED_NOW` again.
- A test that needs time to pass (a TTL that lapses, a measured wait, two calls
  that need distinct milliseconds) moves the frozen clock forward with
  `vi.setSystemTime(Date.now() + ms)` instead of sleeping, as in
  `tests/server/core/kv.test.ts`.
- Code that reads `Date.now()` between timers, such as a deadline loop, runs
  under `vi.useFakeTimers()` with `await vi.advanceTimersByTimeAsync(ms)`. The
  default fakes `Date` too, starting at `FIXED_NOW`, so both move together.
  Reset with
  `vi.useRealTimers()` in `afterEach`.
- `vi.useFakeTimers({ toFake: [...] })` without `"Date"` in the list puts the
  real `Date` back until `vi.useRealTimers()`, and `vi.setSystemTime(...)`
  then moves only the fake timers' clock, not `Date`. List
  `"Date"` when the test writes or compares dates. The setup's `beforeEach`
  calls `vi.useRealTimers()` before it pins `FIXED_NOW`, so the next test
  starts frozen even if this one never restored its timers.
- Wait for asynchronous work with `until(check, what, ms)` or
  `eventually(check, ms)` from `tests/server/fixtures/until.ts`, never a
  `Date.now()` deadline loop, which never ends on the frozen clock. Their
  deadlines read real time and stop just before the test's own timeout, so a
  stuck wait fails with `Timed out waiting for <what>` rather than vitest's
  generic timeout.
- Do not call `vi.useRealTimers()` to opt a test out of the frozen clock. A row
  written at the real time is later read against `FIXED_NOW`, and the result
  depends on the day the suite runs. Call it only to undo `vi.useFakeTimers()`.

## Coverage checklist per route

1. Success path with the right status (`200`, `201`, `204`) and body shape
2. Validation errors (`400` with `error.details`)
3. Auth guard (`401` without a token; `401`/`403` on admin routes)
4. Edge cases: missing resources (`404`), bad ids, pagination limits

## Client tests

Vitest + `@testing-library/react` in jsdom, aliases shared with the build:

```tsx
import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { Button } from "@groot/ui/button";

it("renders", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText("Click me")).toBeInTheDocument();
});
```

## End to end

`pnpm test:e2e` runs `tests/e2e/*.spec.ts` in Chromium, headed locally and
headless when `CI` is set (`playwright test -c playwright.headless.config.ts`
forces headless with a list reporter). Playwright starts the server itself on
`http://localhost:3000` against a throwaway database: it deletes
`data/e2e.db*`, seeds it with `scripts/seed.ts` and runs
`tsx watch apps/web/src/server/entry.node.ts` with
`DATABASE_URL=file:./data/e2e.db`; `tests/e2e/global-setup.ts` runs the same
`seed()`, so the demo user exists. Your `data/dev.db` is never touched.

Outside CI an already running server on port 3000 is reused (for example
`PORTLESS=0 pnpm dev`); the specs then run against that server's database.
CI does not run Playwright.

## Continuous integration

`.github/workflows/test.yml` runs, in order: a gitleaks scan of the commits
the PR or push adds (`scripts/secret-scan.sh`), the static gates through
`pnpm verify:static` (typechecks for the server, the client, the e2e specs,
typecheck coverage and the kit fixture, the kit export guard, the changeset gate, the
checks-coverage guard, lint + format, the doc reference check, the
design-token check, and a migration freshness check that `pnpm db:generate`
adds no migration; the list lives in `scripts/gates.mjs`), server and client
tests, `pnpm build`, the runtime dependency closure check, a wrangler dry run, and a pruned
production boot (tracked files plus `dist` copied to a fresh directory,
`pnpm install --prod`, `node dist/server/bundle.js`, `/health` answers,
`SIGTERM` exits within 15 s).
