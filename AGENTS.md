# FeedbackBarn — engineering guide

Lightweight self-hostable feedback widget (feedback.fish style) on the Cloudflare free tier.

## Principles

- Thin Hono routes: parse/validate at the boundary, delegate to `src/db/queries.ts` or `src/lib/`, map errors to status codes.
- Validate untrusted input once, in `src/lib/validate.ts` and route parsers. Trust internal types.
- The GitHub PAT is encrypted at rest (`src/lib/crypto.ts`, AES-GCM under APP_SECRET) and never leaves the worker except to api.github.com. Never return it in an API response.
- Tests run inside workerd via `@cloudflare/vitest-plugin` with `SELF.fetch()`; outbound GitHub calls are stubbed with MSW (`test/gh-server.ts`).
- The web widget is hand-written vanilla JS. Edit `src/embed_widget.js`, then run `python3 scripts/build-embed.py` to regenerate `src/embed_js.ts`. Never edit the generated file.
- Android SDK lives in `android/` (namespace io.nesin.feedbackbarn, no third-party deps beyond coroutines). Keep the upload contract in `docs/CONTRACT.md` in sync with any API change.
- Free-tier ceilings matter: no queues, no Durable Objects, batch D1 where possible, media caps enforced in code.

## Dev

- `npm run dev` — wrangler dev at :8787 (migrations apply automatically). Set `APP_SECRET` env var first.
- `npm run dev:web` — Vite dashboard at :5173, proxies to :8787.
- `npm test` — vitest in workerd, no account needed.
- `npm run typecheck`
- Android: `cd android && ./gradlew :sdk:assembleRelease :app:assembleDebug :sdk:testReleaseUnitTest`

## Surfaces

- `/` — dashboard SPA (login seeds the first admin).
- `/demo` — worker-served demo page exercising the widget.
- `/embed.js` — the widget script (reads data-project, data-endpoint, data-position).
- `/api/feedback` — public multipart submit endpoint (see docs/CONTRACT.md).
- `/f/<key>` — public R2 media.
