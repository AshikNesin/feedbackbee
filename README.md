# FeedbackBee

Lightweight, self-hostable user feedback on the Cloudflare free tier. Visitors click a widget in your app, annotate a screenshot or record the screen, and the feedback lands as a labeled GitHub issue.

### Widget

A single panel: pick a type, write a note, attach a screenshot, page recording or voice note, send. Screenshots capture the current page with no screen-share prompt, then open in a CleanShot-style editor (arrow, box, highlighter, text, step numbers, pixelate).

<p>
  <img src="docs/screenshots/widget-panel.png" alt="Feedback widget open on a checkout page with a note and an annotated screenshot attached" width="49%" />
  <img src="docs/screenshots/widget-annotate.png" alt="Annotation editor with an arrow and a box around a broken total and pixelated revenue" width="49%" />
</p>

### Dashboard

One inbox per project, filtered by type. Rows expand to the screenshot, session replay or voice note, the GitHub issue, and the reporter's device context.

<p>
  <img src="docs/screenshots/dashboard-inbox.png" alt="Dashboard inbox listing feedback with type dots, thumbnails, replay and voice chips, and issue numbers" width="49%" />
  <img src="docs/screenshots/dashboard-detail.png" alt="Expanded feedback row showing the annotated screenshot, issue and reply buttons, and browser context" width="49%" />
</p>

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AshikNesin/feedbackbee)

One click provisions D1 + R2, builds, and deploys; migrations apply on the first request. Before connecting GitHub, set the required encryption secret with `openssl rand -base64 32 | pnpm exec wrangler secret put FEEDBACKBEE_ENCRYPTION_KEY`. Keep this Worker secret outside D1 and its backups; do not change or lose it. Open `/app` on the deployed URL and the first sign-in creates your owner account (the website from `site/` is served at `/`). In **Settings → GitHub**, register a private GitHub App from the manifest, choose a personal or organization owner, then install it on the repositories you want to use. FeedbackBee does not accept manually pasted GitHub credentials.

- **PRD**: [docs/PRD.md](docs/PRD.md)
- **Upload contract**: [docs/CONTRACT.md](docs/CONTRACT.md)
- **Deploy runbook**: [docs/DEPLOY.md](docs/DEPLOY.md)
- **Android SDK**: `android/` (Kotlin, `FeedbackBee.init(app, projectId, endpoint)`, shake-to-feedback)
- **iOS SDK**: `ios/` (Swift package, `FeedbackBee.configure(projectId:endpoint:)`, shake-to-feedback)
- **React Native**: `react-native/` (TurboModule over the native SDKs, `FeedbackBee.init({ projectId, endpoint })`)
- **Boilerplate**: built on [groot](https://github.com/AshikNesin/groot) (Hono + React + Drizzle); its guides start at [docs/README.md](docs/README.md)

## Embed in any web app

```html
<script src="https://your-bee.workers.dev/embed.js" data-project="myapp" async></script>
```

## Android

```kotlin
FeedbackBee.init(this, projectId = "myapp", endpoint = "https://your-bee.workers.dev")
FeedbackBee.open() // or your own button
```

The Android `endpoint` is required: use your FeedbackBee website or Worker base URL. There is no default server.

## iOS

```swift
try FeedbackBee.configure(projectId: "myapp", endpoint: "https://your-bee.workers.dev")
FeedbackBee.open() // or your own button
```

See [ios/README.md](ios/README.md).

## React Native

```ts
import FeedbackBee from "react-native-feedbackbee";

FeedbackBee.init({ projectId: "myapp", endpoint: "https://your-bee.workers.dev" });
FeedbackBee.open(); // or your own button
```

The sheet, capture and upload are the native iOS and Android SDKs; see [react-native/README.md](react-native/README.md).

## Local dev

```bash
pnpm install
pnpm dev           # Node + Vite HMR; sign in with demo@example.com / demo@example.com
pnpm dev:worker    # the real Worker in workerd (local D1 + R2) at http://localhost:8787
pnpm test:worker   # FeedbackBee's integration suite, in workerd
pnpm test          # groot's server suites
```

For local GitHub integration, set `FEEDBACKBEE_ENCRYPTION_KEY` in `.env` (`pnpm dev`) or `.dev.vars` (`pnpm dev:worker`) using `openssl rand -base64 32`. GitHub App registration requires a public HTTPS callback: run local development behind an HTTPS tunnel and set `ORIGIN` explicitly to that tunnel URL. `GET /demo` hosts a demo page with the widget; the `demo` project is provisioned on first visit.

## Inspiration

- Feedback.fish
