# Jobs

The Jobs dashboard at `/jobs` lists background jobs with status filters, row
selection, a row actions menu and a detail page at `/jobs/<id>`. The user can
enqueue a job by name from `Add job`. The in-process worker polls every 5 s
(and ticks right after an add) and runs it, writing status and logs to the
`jobs` and `job_logs` tables.

## Sub-features

- `jobs-add` enqueues a registered job (`todo-summary` or `todo-cleanup`)
  from the `Add job` dialog.
- `jobs-run` sees the job finish, with its status in the table and the detail
  page.
- `jobs-select` checks a row's checkbox without leaving `/jobs`.
- `jobs-detail` opens `/jobs/<id>` from the row's `View details for job …`
  link.
- `jobs-delete` deletes a job from the row's `Actions for job …` menu after a
  confirm.

## How to get to it (user POV)

- Account menu (`Demo User`), then `Jobs`.
- ⌘K, then type `Jobs`.
- Go to `/jobs` directly.

## Driving it with drive.mjs

Preconditions:

- Logged in (driver default). The job queue is empty on a fresh launch.

- **Open.** `page.goto("/jobs")`. The heading `Jobs` (level 1) is visible.
- **Add.** Choose `getByRole("button", { name: /add job/i })`, click
  `#job-name`, choose `getByRole("menuitem", { name: "todo-summary" })`, then
  `getByRole("dialog").getByRole("button", { name: /^add job$/i })`. A
  `View job` link may appear. Its href ends with the job id.
- **Find the row.** Rows are named `Job todo-summary (<id first 6 chars>)`.
  Use `getByRole("row", { name, exact: true })`.
  `db("select id, name, status from jobs where name = 'todo-summary'")`
  returns the job.
- **Run.** `expect.poll` on the job's `status` in `db()` until it's terminal,
  then reload. The row shows the same status, and
  `db("select * from job_logs where job_id = ?", id)` has the handler's logs.
- **Select.** Click `row.getByRole("checkbox", { name: /^Select job todo-summary/ })`.
  It's checked and the URL still ends `/jobs`.
- **Detail.** Choose link `View details for job todo-summary …`. The URL is
  `/jobs/<id>`.
- **Delete.** Hover the row, choose
  `row.getByRole("button", { name: /^Actions for job/ })`, then
  `getByRole("menuitem", { name: "Delete" })`, then `Delete` in the
  `alertdialog`. The row disappears and the `jobs` row is gone.

## Gotchas

- If the `View job` link doesn't show within about 3 s, find the new id by
  diffing the `View details for job todo-summary` link hrefs before and after
  adding, as `tests/e2e/verify-job-selection.spec.ts` does.
- Ids show truncated to 6 characters in the table. Match the full id from the
  href or `db()`.
- The `job_logs` column names and the terminal status values haven't been
  checked through this harness yet. Look at a row before asserting on them.
