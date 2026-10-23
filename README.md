# FeedbackBee

Lightweight, self-hostable user feedback on the Cloudflare free tier. Visitors click a widget in your app, annotate a screenshot or record the screen, and the feedback lands as a labeled GitHub issue. Think feedback.fish that you own.

**Website**: [feedbackbee.nesin.io](https://feedbackbee.nesin.io) · MIT licensed

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

One click provisions D1 + R2, applies migrations, builds, and deploys. Open the deployed URL and the first login creates your owner account. Then set one secret: `pnpm exec wrangler secret put GITHUB_TOKEN` (fine-grained PAT, Issues: Read and Write).

- **PRD**: [docs/PRD.md](docs/PRD.md)
- **Deploy runbook**: [docs/DEPLOY.md](docs/DEPLOY.md)
- **Android SDK**: `android/` (Kotlin, `FeedbackBee.init(app, projectId, endpoint)`, shake-to-feedback)

## Embed in any web app

```html
<script src="https://your-bee.workers.dev/embed.js" data-project="myapp" async></script>
```

## Android

```kotlin
FeedbackBee.init(this, projectId = "myapp", endpoint = "https://your-bee.workers.dev")
FeedbackBee.show() // or your own button
```

The Android `endpoint` is required: use your FeedbackBee website or Worker base URL. There is no default server.

## Local dev

```bash
pnpm install
pnpm run dev       # API at http://localhost:8787, dashboard at /
pnpm test          # workerd integration tests
```

`GET /demo` hosts a demo page with the widget. The `demo` project is provisioned automatically on first visit.
