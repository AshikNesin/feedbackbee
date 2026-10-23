# feedbackbee.nesin.io

Static landing page. No build step: deploy this directory as-is (Cloudflare Pages output directory `website`, no build command). `_headers` sets cache and security headers on Pages.

- `index.html` — the whole page (inline CSS and JS).
- `demo.webm` / `demo.mp4` / `poster.jpg` — product demo, recorded with Playwright against `pnpm run dev` (the real widget, with the submit response mocked).
- `og.png` — 1200×630 social card.
