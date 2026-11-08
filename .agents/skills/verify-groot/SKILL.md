---
name: verify-groot
description: Launch an isolated Groot web app (React SPA + Hono API on SQLite), drive it in headless Chromium the way a user would, and capture screenshots, ARIA snapshots and database proof. Use to prove a UI or API change works in the real app — todos, login/logout, storage, settings, jobs — rather than only in unit tests.
---

# verify-groot

Groot's user surface is the web app at `apps/web`: a React SPA served by Vite
in dev, talking to a Hono API under `/api/v1`, with SQLite on disk and uploads
on the local filesystem. The harness is Playwright (the repo's own
`@playwright/test`) run from small Node scripts in this folder. Every run gets
its own port, database and uploads folder, so it never touches the developer's
`pnpm dev` (`data/dev.db`, port 3000) or the e2e suite (`data/e2e.db`, port
3000).

All commands run from the repo root. `<run>` is any short name you pick
(`fix-123`, `proof-1`); it keys the instance and its evidence.

Before driving a feature, read [`features/README.md`](features/README.md) and
the feature's own file. The map lists every entry point you must cover.

## Launch

```bash
pnpm install   # once per checkout
node .agents/skills/verify-groot/scripts/launch.mjs <run> [--port 3100]
```

What it does: creates `tmp/verify-groot/<run>/` with a fresh `app.db` and
`uploads/`, runs `scripts/seed.ts` against it (all migrations, user
`demo@example.com` / `demo@example.com`, todos `Learn Drizzle` (done),
`Build an API`, `Write tests`), then starts `apps/web/src/server/entry.node.ts`
under tsx in its own process group with `NODE_ENV=development`.

It needs **two** free ports: `PORT` for HTTP and `PORT+1` for Vite's HMR
websocket. If either is taken it refuses and names the owner; pick another
`--port` (for a second parallel run, `--port 3200`). Never kill the owner.

Ready means usable, and launch prints `READY http://localhost:<port>` only
when all three hold: `/ready` returns `{"ready":true}`, `GET
/api/v1/auth/setup` reports `needsSetup: false` (the demo user exists), and
`/login` serves the SPA shell with `/src/client/main.tsx`. It gives up after
120 s and prints the tail of `tmp/verify-groot/<run>/server.log`.

The server does **not** reload on code changes. After editing app code,
clean up and launch again; doctor flags a stale build.

Teardown is [Cleanup](#cleanup).

## Doctor

```bash
node .agents/skills/verify-groot/scripts/doctor.mjs <run>
```

Read-only (it never logs in, because login is rate limited). Run it first
whenever anything looks off. It checks that the process group is alive, the
port is held by a process in this run's group (via `lsof`), `/ready` is ready,
the demo user is seeded, the run's database file exists, and the checkout's
build id (HEAD plus a hash of uncommitted tracked changes) matches the one
launched. Exit 0 means drive it; anything else means fix it, or clean up and
relaunch.

## Drive

```bash
node .agents/skills/verify-groot/scripts/drive.mjs <run> <journey.mjs> [--headed]
```

A journey is a small ES module. The driver opens Chromium at 1280×800, logs in
through the real `/login` form unless the journey exports `login = false`,
then calls it:

```js
export default async function ({ page, step, expect, db, api, note }) {
  await step("open todos page", async () => {
    await page.goto("/todos");
    await expect(page.getByRole("heading", { name: "Todos", level: 1 })).toBeVisible();
  });
  const rows = db("select id, title, completed from todos where title = ?", "Write tests");
  note(`db: ${JSON.stringify(rows)}`);
}
```

- `step(label, fn)` runs `fn`, then saves a full-page screenshot and an ARIA
  snapshot, and logs the step in `steps.md`. Put each user action and its
  assertions in one step.
- `db(sql, ...params)` runs a read-only query on the run's database through
  `scripts/db.ts`. Each call takes about 1 s, so give `expect.poll` a
  `timeout` of 15 s or more.
- `api(path, { method, body })` calls the API with the browser's session
  cookie, for when the API itself is what you're proving.
- `note(text)` adds a line under the last step in `steps.md`.
- `expect` is Playwright's.

Ready-made journeys live in `journeys/`. Run
[`journeys/todos.mjs`](journeys/todos.mjs) to see the whole flow:

```bash
node .agents/skills/verify-groot/scripts/drive.mjs <run> .agents/skills/verify-groot/journeys/todos.mjs
```

For a one-off check, write the journey under
`tmp/verify-groot-journeys/` (gitignored). Add it to `journeys/` when it
covers a feature-map entry for good.

Select by role and accessible name, as `tests/e2e/*.spec.ts` does. Stable
handles in this app:

- Login form: `getByLabel(/email/i)`, `getByLabel(/password/i)`,
  `getByRole("button", { name: "Sign In", exact: true })`.
- Page headings: `getByRole("heading", { name: "<Page>", level: 1 })`.
- The sidebar shows only Todos. Reach Storage, Jobs and Settings by URL, the
  account menu (`getByRole("button", { name: /demo user/i }).last()`), or ⌘K.
- Settings shortcut: `mod+,`.

**Chromium.** The driver uses the browser that matches the repo's Playwright.
If that isn't installed, it says so and exits. Run
`pnpm exec playwright install chromium`, or set `VERIFY_CHROMIUM_PATH` to an
existing binary. In Claude Code cloud containers the preinstalled browser is
for another Playwright version, so use
`VERIFY_CHROMIUM_PATH=/opt/pw-browsers/chromium`.

Read the database by hand with the command below. It goes through the app's
own database layer, as `scripts/seed.ts` does, because AGENTS.md rule R8a
forbids opening a second driver. It accepts one `SELECT`/`WITH` statement,
with `?` placeholders bound to the extra arguments.

```bash
node_modules/.bin/tsx .agents/skills/verify-groot/scripts/db.ts <run> "select id, title from todos where completed = ?" 0
```

Tables: `todos`, `users`, `passkeys`, `kv`, `jobs`, `job_logs`,
`job_schedules`. Uploaded files land in `tmp/verify-groot/<run>/uploads/`.

## Evidence

Each drive writes to `.screenshots/verify-groot/<run>/<journey>-<time>/`
(`.screenshots/` is gitignored):

| File                              | What it proves                                      |
| --------------------------------- | --------------------------------------------------- |
| `NN-<step>.png`                   | what the user saw after each action                 |
| `NN-<step>.aria.yml`              | the same state as roles and names, diffable as text |
| `steps.md`                        | each action in order, its URL and `note()` lines    |
| `console.log`                     | browser console errors and warnings, 4xx/5xx calls  |
| `result.json`                     | `ok`, the error, the steps and the build id         |
| `failure.png`, `failure.aria.yml` | the page at the moment a step threw                 |

Proof standards:

- Drive the real user path: the form, button or link a person would use, not
  a direct `fetch` or test-only shortcut. Use `api()` only when the API is the
  feature.
- Capture the action and the resulting state. One step per action, so the
  screenshots show the change and not just the end.
- Check side effects too. For a mutation, query the row with `db()`, or check
  the file on disk under `uploads/`. Reload the page to prove it persisted.
- Nothing is mocked. The app's only external services (Sentry, Pushover,
  Cloudflare AI) are off unless their keys are set; launch doesn't set them.
- A failed journey is a result, not something to work around. Report it with
  its `failure.png` and the error from `result.json`. Never loosen an
  assertion to make it pass. If the seed lacks a precondition, say so.
- Two expected 401s on `/api/v1/auth/me` before login are in every
  `console.log`. Anything else in there is worth a look.

## Cleanup

```bash
node .agents/skills/verify-groot/scripts/cleanup.mjs <run>
```

This sends SIGTERM to the process group recorded at launch, then SIGKILL after
10 s, and deletes `tmp/verify-groot/<run>/` (database, uploads, log). It never
kills by name or port, and never touches `.screenshots/verify-groot/<run>/`.
It prints the evidence it kept. Run it after every run, including failed
launches and failed drives, so no orphan server holds the port.

Delete old evidence by hand when you no longer need it:
`rm -rf .screenshots/verify-groot/<run>`.

## Helpers

All are executable Node scripts. Run them from the repo root as shown above.

- `scripts/launch.mjs <run> [--port N]`: start and wait for ready.
- `scripts/doctor.mjs <run>`: read-only health check.
- `scripts/drive.mjs <run> <journey.mjs> [--headed]`: run a journey and
  record evidence.
- `scripts/db.ts <run> "<sql>" [params...]`: read-only query (run with
  `node_modules/.bin/tsx`).
- `scripts/cleanup.mjs <run>`: stop and delete state, keep evidence.
- `scripts/lib.mjs`: shared paths and probes (not a command).
- `journeys/todos.mjs`: the todos journey, proven end to end.
