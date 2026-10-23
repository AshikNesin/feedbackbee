# feedbackbee.nesin.io

Static landing page. No build step: deploy this directory as-is (Cloudflare Pages output directory `website`, no build command). `_headers` sets cache and security headers on Pages.

- `index.html`: the whole page (inline CSS and JS).
- `demo-music.webm` / `demo-music.mp4`: product demo with an original synthesized backing track; the page plays it muted with a sound toggle.
- `demo.webm` / `demo.mp4`: the same demo without audio, for sharing. `poster.jpg` is its first frame.
- The demo is the real widget recorded with Playwright against `pnpm run dev` (only the submit response is mocked).
- `og.png`: 1200×630 social card.
