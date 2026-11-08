# Background jobs

The `jobs` table is the queue. There is no broker and no adapter: `addJob()`
inserts a row, `runTick()` claims due rows with a single `UPDATE … RETURNING`
and runs them in-process. On Node a poller calls `runTick()` every few seconds;
on Cloudflare Workers a cron trigger calls it once a minute; and any write
that leaves a job `created` and due (`addJob()`, a retry, a resume...) kicks off
an inline tick so it runs right after the response.

Everything lives in `@groot/jobs`: `@groot/jobs/lifecycle` (the state machine),
`@groot/jobs/server` (queue, transitions, tick, worker, routes, logger, schema) and
`@groot/jobs/client` (the dashboard). Handlers are app-owned
(`apps/web/src/server/api/<feature>/<feature>.jobs.ts`).

## Tables (`packages/jobs/src/server/schema.ts`)

| Table           | Row                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jobs`          | `id` (uuid), `name`, `data` (JSON), `state`, `priority`, `retryLimit`, `retryCount`, `retryDelay` (s), `runAt`, `startedAt`, `completedAt`, `createdAt`, `output` (JSON), `error`, `singletonKey` |
| `job_schedules` | one per job name (`name` is the primary key): `cron`, `data`, `timezone`, `lastRunAt`                                                                                                             |
| `job_logs`      | `jobId`, `jobName`, `level`, `message`, `data`, `timestamp` (info and above)                                                                                                                      |

States: `created` → `active` → `completed` | `failed` | `cancelled`.

## Lifecycle (`@groot/jobs/lifecycle`)

One runtime-neutral module holds the state machine; the queue and the
dashboard both import it, so the buttons a page shows and the requests the
server accepts cannot drift apart.

| Action   | Allowed from          | Does                                   |
| -------- | --------------------- | -------------------------------------- |
| `retry`  | `failed`, `cancelled` | back to `created`, error cleared       |
| `rerun`  | `completed`, `failed` | queue a fresh copy; the original stays |
| `resume` | `cancelled`           | back to `created`                      |
| `cancel` | `created`, `active`   | to `cancelled`                         |
| `delete` | any state             | remove the row                         |

`JOB_STATES`, `isValidJobState`, `isTerminalJobState`, `JOB_ACTIONS`,
`canApplyJobAction(action, state)` and `allowedJobActions(state)` are exported
from `@groot/jobs/lifecycle` (and re-exported by `@groot/jobs/server`).

Each state change is one compare-and-set `UPDATE … WHERE id = ? AND state IN
(<allowed>) RETURNING`. A cancel that arrives after the tick completed the job
changes nothing and answers `400` (`JOB_ACTION_NOT_ALLOWED`); an unknown job
answers `404` (`JOB_NOT_FOUND`). The tick guards its own writes the same way
(`WHERE state = 'active' AND started_at = <the claim's>`), so a job cancelled
mid-run stays cancelled (the handler itself is not interrupted), and a run that
outlived its timeout cannot overwrite the attempt that replaced it.

`retry` and `resume` keep `retryCount`, so a job that used up its retries gets
one more attempt, not a fresh set. `rerun` queues a new job with the same
name, data, priority and retry settings and a `retryCount` of 0.

## Transitions (`packages/jobs/src/server/transitions.ts`)

Every write to a job row goes through one module, so the rules above live in
one place:

- `enqueue(spec)` is the only insert into `jobs`: `addJob()`, schedule fires
  and `rerun` all use it, with the same defaults (`defaultJobOptions()`).
- `apply(job | jobId, event)` runs one event as one compare-and-set
  `UPDATE … RETURNING`. Operator events are the lifecycle actions (`retry`,
  `rerun`, `resume`, `cancel`, `delete`) and throw the `404` / `400` above.
  Tick events (`succeed`, `fail`, `timeout`) return the updated row, or `null`
  when the job moved on meanwhile.
- `claim(names, limit)` moves due jobs to `active` for the tick.

It also owns the **retry policy**, the same for a handler that throws and for
a job that timed out while `active`: while `retryCount < retryLimit` the job
goes back to `created` with `runAt = now + retryDelay × 2^retryCount` seconds
(capped at 24 h) and `retryCount + 1`, otherwise it is `failed`. Either way an
error line goes to `job_logs` ("Job <name> failed" or "Job <name> timed out")
before the state changes, and the writer that wins the compare-and-set calls
`reportError()`, so a failure that loses to a cancel, a delete or another
process is logged but not reported twice.

Whenever an event lands a job in `created` with `runAt ≤ now`, the module
nudges the [inline tick](#who-calls-the-tick). Use the queue functions, or
`jobRunner.transitions` for the instance wired to the runner; the module's
`getJobById`, `jobNotFound` and `assertJobName` are what the queue and routes
use.

## Handlers

```ts
import { registerJobHandler, type JobContext } from "@groot/jobs/server";

export async function sendDigest(job: JobContext<{ userId: number }>) {
  job.logger.info({ userId: job.data.userId, attempt: job.attempt }, "Sending digest");
  // ...
  return { sent: 1 }; // any JSON-serialisable value is stored as job.output
}

export function registerDigestJobs(): void {
  registerJobHandler("send-digest", sendDigest);
}
```

`JobContext<T>` is `{ id, name, data, attempt, logger }` (`attempt` is 1 for the
first run, 2 for the first retry).

Call your `register…Jobs()` from `registerJobHandlers()` in
`apps/web/src/server/app.ts`; `startWebApp()`, the one boot sequence both
entries run, calls it before the poller or the first cron tick. Registering a
name again replaces its handler. Any non-empty name works (routes address a job
by its id, never its name). A job whose name has no registered handler is
accepted but never claimed, and stays `created` until one is registered.

## Queueing and managing

```ts
import { addJob, scheduleJob } from "@groot/jobs/server";

await addJob("send-digest", { userId: 1 });
await addJob(
  "send-digest",
  { userId: 1 },
  {
    delaySeconds: 60, // or runAt: new Date(...)
    priority: 5, // higher runs first
    retryLimit: 5, // default config.jobs.retryLimit
    retryDelaySeconds: 30, // base delay, doubles per attempt; default config.jobs.retryDelaySeconds
    singletonKey: "user:1", // at most one created/active job per name + key; returns the existing id
  },
);
await scheduleJob("todo-cleanup", { daysToKeep: 30 }, "0 3 * * *", { timezone: "Asia/Kolkata" });
```

| Function                                                                                                                 | Does                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `addJob(name, data, options?)` → id                                                                                      | Insert a `created` row; triggers an [inline tick](#who-calls-the-tick) when it is due                                               |
| `scheduleJob(name, data, cron, { timezone? })`                                                                           | Create or replace the one schedule for `name`; replacing keeps `lastRunAt`. A bad cron is a `400` (`JOB_SCHEDULE_VALIDATION_ERROR`) |
| `cancelScheduledJob(name)`                                                                                               | Delete a schedule; `404` when there is none                                                                                         |
| `retryJob(id)`, `cancelJob(id)`, `resumeJob(id)`, `rerunJob(id)` → new id, `deleteJob(id)`, `rerunJobs(ids)`             | The [lifecycle](#lifecycle-grootjobslifecycle) actions                                                                              |
| `getJobs`, `getJobById(id)`, `getQueueStats`, `getAvailableQueues`, `getScheduledJobs`, `getJobLogs`, `purgeJobsByState` | Queries (`queries.ts`)                                                                                                              |

Cron expressions are evaluated by croner. Without a `timezone` they use the
process's local time zone: UTC on Workers, the host's `TZ` on Node. Pass
`timezone` when the schedule must not depend on the host.

## The tick (`packages/jobs/src/server/tick.ts`)

`JobRunner` owns all runner state: the handler registry, the in-flight tick and
its re-run request, the Node poll timer, and the transitions wired to nudge it.
`jobRunner` is the process-wide instance; `runTick()`, `tickInFlight()`,
`registerJobHandler()`, `startWorkers()` and `stopWorkers()` are functions over
it. `jobRunner.reset()` gives a test fresh state (no handlers, no poller, no
pending re-run, no housekeeping schedule).

One `runTick()` pass:

1. **Schedules** — for each row in `job_schedules`, compute the next fire after
   `lastRunAt ?? createdAt`; if it is due, compare-and-set `lastRunAt` to now
   and enqueue a job (with the default retry settings). Two concurrent ticks can
   never enqueue the same fire, and fires missed while nothing was ticking
   collapse into one job.
2. **Recover** — each `active` job whose `startedAt` is older than
   `config.jobs.activeTimeoutSeconds` gets a `timeout` event: the
   [retry policy](#transitions-packagesjobssrcservertransitionsts), with its
   backoff, log line and report, as if its handler had thrown.
3. **Claim** — up to `config.jobs.batchSize` `created` jobs with
   `runAt ≤ now` and a registered handler, ordered by priority desc, `runAt`,
   `createdAt`, moved to `active` in one `UPDATE … WHERE id IN (subquery) RETURNING`.
4. **Run** each claimed job sequentially. Success → `completed` with `output`.
   A throw → the retry policy: `created` again after a backoff while retries
   remain, otherwise `failed` with the error message.
5. **Housekeeping**, at most every 10 minutes across every process and
   isolate: delete `completed` and `cancelled` jobs whose `completedAt` is
   older than `config.jobs.keepCompletedDays`, their logs, and expired kv
   entries. Failed jobs stay until you purge them. The last run time is a kv
   row (`jobs:housekeeping:lastRunAt`) claimed with one compare-and-set upsert,
   because a fresh Workers isolate has no memory of the last run. Every
   statement uses an index (`jobs_state_completed_at_idx`, `job_logs_job_id_idx`,
   `kv_expires_at_idx`), so on D1 the rows read follow what is deleted, not
   table size.

Only one tick runs at a time per process; a `runTick()` call during a tick
returns the running one and schedules one more pass after it (without
schedules or housekeeping). `tickInFlight()` waits for both.

## Who calls the tick

| Runtime | Driver                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node    | `startWorkers()` in `entry.node.ts` when `config.jobs.enabled`: one tick immediately, then every `config.jobs.pollIntervalSeconds`; `stopWorkers()` on shutdown waits for the in-flight tick. With no handlers registered it logs an error and does not poll                                                                                            |
| Workers | the `scheduled` handler (cron `* * * * *` in `wrangler.jsonc`) → `ctx.waitUntil(runTick())`. It does not read `config.jobs.enabled`; remove the trigger to stop it                                                                                                                                                                                      |
| Both    | every transition that lands a job in `created`, due, with a handler registered (`addJob()`, `retryJob()`, `resumeJob()`, `rerunJob()`, a schedule fire, a zero-delay retry) runs an inline tick, with schedules and housekeeping skipped, when `config.jobs.enabled` and `config.jobs.runInline` are true; on Workers through the request's `waitUntil` |
| Tests   | jobs are disabled, so nothing ticks on its own; call `await runTick()` yourself, and `jobRunner.reset()` in `beforeEach`                                                                                                                                                                                                                                |

Every `config.jobs` key and its default is listed in
[Config](../reference/config.md#settings); override them in
`apps/web/src/server/config.ts`.

## Logs

`job.logger` writes to the normal log stream and persists `info` and above to
`job_logs`, which the dashboard shows per job. Rows are written whatever the
console log level is, so a `silent` logger in tests still leaves a trail.
`createJobLogger({ jobId, jobName })` builds one outside a handler;
`flushJobLogs()` waits for pending writes (the tick does this before marking a
job done).

Logs are deleted with their job: by `deleteJob()`, by a purge, and by
housekeeping, all through `deleteJobLogs(ids)`. A job deleted while its
handler is still running loses the rows written after the delete when the
tick finishes it.

## HTTP API (`/api/v1/jobs`, JWT)

| Method | Path                                    | Body / query                                        | Returns                                                         |
| ------ | --------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| POST   | `/`                                     | `{ jobName, data?, options? }`                      | `201` `{ jobId, jobName, data }`                                |
| POST   | `/schedule`                             | `{ jobName, cron, data?, options?: { timezone } }`  | `201` the schedule (creates or replaces; this is also the edit) |
| GET    | `/schedule`                             |                                                     | schedules, by name                                              |
| DELETE | `/schedule/:jobName`                    |                                                     | `200` `{ success: true }`, `404` if none                        |
| GET    | `/stats`                                |                                                     | a count for every state                                         |
| GET    | `/available`                            |                                                     | `{ jobs: string[] }` (names seen + registered)                  |
| DELETE | `/state/:state`                         |                                                     | `{ count }` purged, with their logs                             |
| GET    | `/`                                     | `?state&name&search&startDate&endDate&limit&offset` | `{ jobs, total }`, newest first; `limit` 1–500, default 50      |
| GET    | `/:jobId`                               |                                                     | the job                                                         |
| GET    | `/:jobId/logs`                          | `?afterId`                                          | log rows with an id above `afterId`                             |
| DELETE | `/:jobId`                               |                                                     | `200` `{ success: true }`                                       |
| POST   | `/:jobId/retry` · `/cancel` · `/resume` |                                                     | `200` `{ success: true }`                                       |
| POST   | `/:jobId/rerun`                         |                                                     | `{ newJobId }`                                                  |
| POST   | `/bulk-rerun`                           | `{ jobIds: string[] }`                              | `[{ jobId, success, newJobId?, error? }]`                       |

`search` on `GET /` matches a substring of the job's name or id,
case-insensitively, and `total` counts every match. `:jobId` is the job's
uuid. `options` on `POST /` takes the `addJob()` options except `runAt`. An
unknown state is a `400`, an unknown job a `404` (`JOB_NOT_FOUND`), and an
action the job's state does not allow a `400`. curl examples are in
[API requests](../reference/api-requests.md#jobs-jwt).

The response types (`Job`, `JobSchedule`, `JobLog`, `JobStats`,
`BulkRerunResult`) are published once in `@groot/jobs/server/wire-types`, with
every timestamp as an ISO string; `@groot/jobs/client/types` re-exports them.

## Dashboard

`@groot/jobs/client` exports the `Jobs` and `JobDetail` pages and `jobsApi`
(typed wrappers over `apiClient`). `apps/web/src/client/App.tsx` mounts `Jobs`
at `/jobs` and `JobDetail` at `/jobs/:jobId`. The hooks and components behind
them are separate subpaths (`@groot/jobs/client/useJobActions`,
`@groot/jobs/client/queries`, `@groot/jobs/client/components/…`).

- The table's row menu and the detail page's buttons both render
  `allowedJobActions(job.state)` and run them through `useJobActions()`, which
  owns the toasts, the confirmations (delete, bulk re-run, purge) and the query
  invalidation, all through the shell's `useAction`
  (`@groot/shell/lib/feedback`), so a failure reads the server's message, an
  offline sentence or the action's fallback, never a bare status line.
- `useJobsFilter()` (`@groot/jobs/client/useJobsFilter`) owns the list's URL
  params (`?state&queue&search&datePreset&page`). Change them through its
  intent setters (`setState`, `setQueue`, `setSearch`, `setPreset`, `clear`),
  each of which goes back to the first page, or `goToPage`. `listParams()`
  maps the filter to the list endpoint's params; the date preset is stored by
  name and resolved to dates when the query runs, so a shared
  `?datePreset=today` link means the day it is opened. `JobsStats` and
  `JobsFilters` take the `filter`; `JobsTable` takes `state`, `page` and
  `onPage`.
- `useJobs()` holds only the list: the filter and the page of jobs it
  selects. Search, the date range and pagination run on the server, so the
  total counts every match. `JobsTable` owns the row selection (a `Set` of job
  ids); `Jobs` remounts it on the filter's `filterKey`, which changes with the
  filter and the page and so clears the selection. Each row is a `row` named
  `Job <name> (<short id>)` with "Select job …", "Actions for job …" and
  "View details for job …" controls; the client and e2e tests find rows by
  these names.
- Every dashboard query key starts with `["jobs"]` (`jobsKeys` in
  `@groot/jobs/client/queries`, which also has `useJobStats()`,
  `useAvailableJobs()` and `useScheduledJobs()`). `JobsStats`,
  `ScheduledJobsPanel` and the job-type pickers load their own data.
- `AddJobDialog` and `ScheduleJobDialog` own their drafts, submit through
  `useAction`, and refresh the queries they affect; a payload that is not JSON
  is refused by `parseJobData` (`@groot/jobs/client/utils`) with a sentence,
  not a raw `SyntaxError`; both edit the payload in `JobDataEditor`
  (CodeMirror). `ScheduleJobDialog` creates a schedule, or edits one when given
  `schedule` (the name is fixed, the timezone is kept, and it saves through
  `POST /schedule`).
- The detail page fetches the job and its logs on load and polls both every
  2 s while the job is `created` or `active`; polling stops once it finishes.

The todo feature's `todo-cleanup` and `todo-summary` are the reference
handlers; see [Todos](./todos.md#background-jobs).

## Good practice

- Keep handlers idempotent: a crashed process re-runs them after the active timeout.
- Keep them short. On Workers a job shares the CPU budget of the request or
  cron run that ticks it; see the
  [free-plan limits](../guides/deploy-cloudflare.md#free-plan-limits-that-shaped-the-design).
- Use `singletonKey` to collapse duplicate work while a job is pending.
- Return small outputs; put large results somewhere else and return a reference.
