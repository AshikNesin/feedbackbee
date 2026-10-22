# FeedbackBarn PRD

Status: v1.0 (build target). Owner: Ashik Nesin.

## Problem

Shipping a feedback button into a web or Android app today means either a heavy SaaS widget, a form that emails a mailbox nobody reads, or nothing at all. The feedback that matters most arrives with context: the screen the user was on, what they circled, what they saw happen. That context is exactly what a GitHub issue needs to be actionable, and exactly what existing lightweight tools drop.

FeedbackBarn gives any project a five-minute feedback loop. Embed one script tag (or one Gradle dependency), let users annotate and record, and every submission becomes a labeled GitHub issue with the media attached.

## Goals

1. One `feedbackbarn()` call renders a working feedback widget in any web app.
2. Feedback becomes a GitHub issue within seconds, tagged by kind, with screenshot or recording attached.
3. A dashboard to create projects, define target repos and labels, and read everything that arrived.
4. An Android SDK with shake-to-feedback that captures a screenshot and uploads to the same endpoint.
5. Runs entirely on the Cloudflare free tier. Self-hostable by anyone with one `wrangler deploy`.

## Non-goals for v1

- Boards, voting, roadmaps, changelogs, or a public feedback portal. Issues are the workspace.
- OAuth device flows or GitHub Apps. PATs are the auth model for v1.
- iOS, Flutter, React Native SDKs.
- Video transcoding, GIF conversion, or frame-accurate trimming.
- Email notifications (GitHub already notifies the repo's watchers).

## Success metrics

- Widget adds < 10 KB gzipped to a host page.
- Widget `init` to first paint < 50 ms (no blocking requests).
- Feedback submit to GitHub issue created < 5 s p95 (measured from submit response).
- Zero paid Cloudflare dependencies. Everything on free-tier ceilings.

## Personas

**Ashik (owner).** Runs several small apps. Wants bug reports with context in his GitHub repos without wiring a SaaS into each one.

**A visitor (reporter).** Non-technical. Hits a bug, wants to tell someone, will not create a GitHub account to do it. Will write two sentences and circle a thing if the tool makes it obvious.

## Product surface

### 1. Projects

The unit of tenancy. Creating a project captures the GitHub wiring up front.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | Human name, e.g. "myapp.dev" |
| `slug` | text | URL-safe, unique, used in the embed snippet |
| `github_repo` | text | `owner/repo`, required to create issues |
| `github_pat` | text | Encrypted at rest with `APP_SECRET`; never returned by any API |
| `labels_map` | json | Feedback kind to GitHub label. Defaults: bug→`bug`, idea→`enhancement`, other→`feedback` |
| `created_at` | timestamp | |

The embed snippet is generated per project.

```html
<script src="https://your-barn.workers.dev/embed.js"
        data-project="myapp" async></script>
```

### 2. Web widget (`embed.js`)

Vanilla JS, one IIFE, zero dependencies, served by the Worker. No framework assumptions on the host page.

Flow on click:

1. Launcher pill appears bottom-right (position configurable).
2. Panel opens with three options: give feedback, report a bug, share an idea.
3. Optional screenshot of the current page via `html2canvas`-style DOM snapshot. This is the one accepted third-party dependency, lazily loaded from the Worker itself (self-hosted, ~45 KB, not counted against the widget's < 10 KB budget). Annotation happens on a canvas overlay: pen, box, and arrow tools, plus undo.
4. Optional screen recording via `getDisplayMedia`, capped at 5 minutes (300 s) with a visible timer. WebM only, client-side enforced.
5. Submit sends multipart form data: project slug, kind, text, optional email, and media files. Anonymous by default.
6. The panel shows a link to the created GitHub issue and a "powered by FeedbackBarn" footer.

Captures standard context automatically: URL, browser, OS, viewport size, and screen resolution.

### 3. Android SDK

A tiny Kotlin library (`io.nesin:feedbackbarn`) an app installs in one call.

```kotlin
FeedbackBarn.init(this, projectSlug = "myapp", endpoint = "https://your-barn.workers.dev")
```

Features:

- `ShakeDetector` on the main activity's sensor events. Three shakes inside 1.5 s opens the feedback sheet.
- Screenshot capture of the activity's window via `PixelCopy` from a `View` reference.
- Annotation on a canvas overlay: pen, box, arrow, undo.
- Screen recording up to 5 minutes via `MediaProjection` with a system prompt and a visible notification.
- Uploads multipart to the same `/api/feedback` endpoint as the web widget. Auto-collects app version, Android version, device model, and screen size.
- The confidential-content rule applies: the SDK never reads notification, SMS, or system logs. Only the app's own window is captured.

### 4. Dashboard (SPA)

Email and password login for the owner. Single owner in v1 (no team seats).

Pages:

- **Projects.** Create, edit, rotate PAT, regenerate nothing (slug is stable).
- **Project detail.** Recent feedback list with media thumbnails, GitHub issue links and states, and the embed snippet with a copy button.
- **Settings.** Change password. That is all.

### 5. GitHub integration

On each feedback submission:

1. Upload media (if any) to R2 under `p/<project>/f/<feedback-id>/<filename>`.
2. Insert the feedback row in D1 with state `pending`.
3. Create the GitHub issue via REST (`POST /repos/{owner}/{repo}/issues`) with a body template: reporter text, context block (key/value table), media links (the R2 public URLs), and the recorder's email if given.
4. Attach media to the issue via the issue-comment upload path if the PAT scope allows; otherwise the body links to R2 URLs. On failure, retry once, then mark `issue_error` with the GitHub API error text.
5. Update the row with `issue_number`, `issue_url`, and state `created`.

Labels: the project's `labels_map` maps the widget kind to repo labels. GitHub auto-creates labels it does not find when the PAT has push access; otherwise the issue is created unlabeled and the state records the label failure.

### 6. Data model (D1)

```sql
project(id, name, slug, github_repo, github_pat_enc, labels_map, created_at)
feedback(
  id, project_id, kind, text, reporter_email,
  url, user_agent, viewport_w, viewport_h, screen_w, screen_h,
  media_kind, media_key, media_seconds,
  app_version, os_name, os_version, device_model,
  issue_number, issue_url, state, issue_error,
  created_at
)
admin(id, email, password_hash)
```

`state` is one of `pending`, `created`, `issue_error`, `deleted`.

`media_kind` is one of `none`, `screenshot`, `recording`.

### 7. API

Public (CORS `*`, rate-limited by IP via D1 counter rows):

| Method | Path | Purpose |
|---|---|---|
| GET | `/embed.js` | The widget script |
| POST | `/api/feedback` | Multipart submit |
| GET | `/f/<key>` | Public R2 media passthrough |

Authenticated (session cookie):

| Method | Path | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Owner login |
| POST | `/auth/logout` | |
| GET | `/api/projects` | List |
| POST | `/api/projects` | Create |
| PATCH | `/api/projects/:id` | Edit (name, repo, PAT, labels) |
| DELETE | `/api/projects/:id` | Delete project + feedback rows (media kept) |
| GET | `/api/projects/:id/feedback` | Paged list |
| GET | `/api/projects/:id/feedback/:fid` | One item with media URL |

### 8. Security

- The GitHub PAT is encrypted at rest with AES-GCM under `APP_SECRET` and decrypted only inside the Worker for the GitHub call. It is never returned by any API response.
- Media uploads are capped (screenshot 10 MB, recording 200 MB, 5 min). Type sniffed at the boundary by magic bytes, not extension.
- `embed.js` sets `rendered` state only after the project slug resolves. Unknown slugs render a friendly "project not found" note, never an error.
- Rate limit: 20 submissions per IP per hour per project, tracked in D1. Excess returns 429 with a plain message.
- The feedback endpoint never reflects user text back unescaped into HTML. All dashboard rendering escapes by default (React).

## Free-tier fit

| Resource | Free ceiling | FeedbackBarn use |
|---|---|---|
| Workers | 100k req/day | Widget + API calls |
| D1 | 5 GB, 5M rows read/day | Projects, feedback, rate limits |
| R2 | 10 GB storage, 1M class-A/month | Screenshots (KBs), recordings (MBs) |
| CPU | 10 ms/req (free) | GitHub call is I/O bound, fits |

Recordings are the pressure point. 200 MB caps and 5-minute limits keep a self-hoster inside R2's 10 GB for realistic volumes. A pruning note lands in the ops README later.

## Release plan

Sequenced as verifiable units. Each milestone ends in a state you can run and check.

1. **M1 API core.** Worker boots, D1 migrated, project CRUD, feedback submit with media to R2, media serve. Verified with vitest in workerd against `SELF.fetch()`.
2. **M2 GitHub bridge.** Issue creation on submit, states, label mapping, retry-then-error. Verified with a stubbed GitHub REST endpoint in tests.
3. **M3 Widget.** `embed.js` with panel, screenshot + annotate, recording with cap, upload. Verified by driving it in a real browser against the local Worker.
4. **M4 Dashboard.** Login, projects, feedback list, snippet copy. Verified in the browser.
5. **M5 Android SDK.** Init, shake detect, screenshot + annotate, upload. Verified by compiling the AAR and driving the demo app in an emulator.
6. **M6 Deploy + docs.** `wrangler deploy` green, README complete, PAT rotation documented.

## Open decisions

- **In-app annotation library for Android.** Build pen/box/arrow on raw `Canvas` (chosen) versus wrapping a third-party annotation lib. Raw Canvas keeps the SDK dependency-free.
- **Recording codec.** WebM/VP9 everywhere (chosen). H.264 would need a transcode path, which is a non-goal.
- **Issue media attach.** Try the upload-then-embed path when the PAT allows; always include R2 links. The fallback is the contract.
- **Multi-owner teams.** Deferred. The schema anticipates it (owner id on project) but v1 ships single-owner.
