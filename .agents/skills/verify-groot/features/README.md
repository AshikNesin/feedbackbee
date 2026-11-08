# Groot verification map

This directory is the maintained source for verifying Groot's user-facing
behavior. Read this index before driving the app, then use the matching
feature file as the recipe.

## Baseline preconditions

- An instance launched by this run with
  `node .agents/skills/verify-groot/scripts/launch.mjs <run>`, so it has a
  fresh database and uploads folder.
- `node .agents/skills/verify-groot/scripts/doctor.mjs <run>` exits 0.
- Seed state: user `demo@example.com` (password `demo@example.com`, name
  `Demo User`); todos `Learn Drizzle` (done), `Build an API` and `Write tests`
  (pending); no files, settings or jobs.
- Never drive an instance this run did not launch, such as the developer's
  `pnpm dev` on port 3000.

## Driving conventions

- Drive through a journey module run by
  `node .agents/skills/verify-groot/scripts/drive.mjs <run> <journey.mjs>`.
  The driver logs in through `/login` first unless the journey exports
  `login = false`.
- Prefer roles and accessible names (`getByRole`, `getByLabel`) over CSS and
  position.
- Use unique names for anything you create (`Verify todo ${Date.now()}`), so
  reruns on the same instance don't collide.
- Login is limited to 20 attempts per 15 minutes per instance. Each drive uses
  one. Relaunch if you hit the limit.
- Modal dialogs hide the page behind them from the accessibility tree. Close
  the dialog before asserting on the page underneath.

## Proof and skip reporting

- One `step()` per user action, so screenshots and ARIA snapshots show the
  action and the resulting state.
- For a mutation, add a second view: a `db()` query on the row, the file under
  `tmp/verify-groot/<run>/uploads/`, or the page after `page.reload()`.
- Name the feature file and entry point used for every proof.
- Report an entry point you could not drive, with the step that failed and
  the unmet precondition. Don't count it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on the user-visible
behavior, then four H2s in this order: `Sub-features`,
`How to get to it (user POV)`, `Driving it with drive.mjs` (starting with
`Preconditions:`), and `Gotchas`.

Status per file: **proven** means a journey in `journeys/` ran green through
this harness. **Mapped** means the selectors come from the passing Playwright
specs in `tests/e2e/`, but no journey has run them through `drive.mjs` yet.

## Features

- [Todos](./todos.md): create, complete, persist, delete. **Proven** by
  `journeys/todos.mjs`.
- [Sign in and out](./auth.md): password login, bad credentials, logout,
  protected-route redirect. **Mapped.**
- [Storage](./storage.md): folders, upload, delete, files on disk.
  **Mapped.**
- [Settings](./settings.md): section navigation and search, configuration
  key/value editor. **Mapped.**
- [Jobs](./jobs.md): enqueue a job, watch it run, select and delete it.
  **Mapped.**
