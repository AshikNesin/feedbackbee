# FeedbackBee — engineering guide

Lightweight self-hostable feedback widget (feedback.fish style) on the Cloudflare free tier.

## Principles

- Thin Hono routes: parse/validate at the boundary, delegate to `src/db/queries.ts` or `src/lib/`, map errors to status codes.
- Validate untrusted input once, in `src/lib/validate.ts` and route parsers. Trust internal types.
- GitHub auth is one global fine-grained PAT held as the `GITHUB_TOKEN` Worker secret. It never leaves the worker except to api.github.com, never lives in D1, and never appears in an API response. Projects store only `owner/repo`.
- Tests run inside workerd via `@cloudflare/vitest-plugin` with `SELF.fetch()`; outbound GitHub calls are stubbed with MSW (`test/gh-server.ts`).
- The web widget is hand-written vanilla JS. Edit `src/embed_widget.js`, then run `python3 scripts/build-embed.py` to regenerate `src/embed_js.ts` (and `src/capture_js.ts`, the pinned `modern-screenshot` UMD build served at `/embed-capture.js` for in-page screenshots). Never edit the generated files.
- Android SDK lives in `android/` (namespace io.nesin.feedbackbee, no third-party deps beyond coroutines). Keep the upload contract in `docs/CONTRACT.md` in sync with any API change.
- Free-tier ceilings matter: no queues, no Durable Objects, batch D1 where possible, media caps enforced in code.

## Dev

- Use pnpm for installs and scripts, not npm or npx. Lockfiles are `pnpm-lock.yaml` at the root and in `web/`.
- `pnpm run dev` — wrangler dev at :8787 (migrations apply automatically). Copy `.dev.vars.example` to `.dev.vars` and set `GITHUB_TOKEN` first.
- `pnpm run dev:web` — Vite dashboard at :5173, proxies to :8787.
- `pnpm test` — vitest in workerd, no account needed.
- `pnpm run typecheck`
- Android: `cd android && ./gradlew :sdk:assembleRelease :app:assembleDebug :sdk:testReleaseUnitTest`

## Surfaces

- `/` — dashboard SPA (login seeds the first admin).
- `/demo` — worker-served demo page exercising the widget.
- `/embed.js` — the widget script (reads data-project, data-endpoint, data-position).
- `/embed-capture.js` — DOM-to-image library the widget lazy-loads on the first screenshot.
- `/api/feedback` — public multipart submit endpoint (see docs/CONTRACT.md).
- `/f/<key>` — public R2 media.
