# feedbackbee.nesin.io

The FeedbackBee website, laid out like 404less's `site/`. Static HTML assembled
by one script; no framework.

- `layout.html`: the shared shell (head, nav, footer). Placeholders `{{title}}`,
  `{{description}}`, `{{ogDescription}}`, `{{canonical}}`, `{{ogImage}}`,
  `{{jsonld}}`, `{{content}}`.
- `pages/*.html`: one file per page, starting with a `<!--meta {json}-->` block
  (`path`, `title`, `description`, optional `ogDescription`, `og`, `noindex`).
- `assets/`: copied as-is to the output root. `site.css` and `site.js` (the whole
  look and the small page script), `img/`, `og/` (1200×630 social card), `demo/`
  (the product demo: `demo-music.*` plays on the page muted with a sound toggle,
  `demo.*` is the same cut without audio for sharing; recorded with Playwright
  against the real widget, only the submit response mocked), plus Cloudflare
  Pages' `_headers` and `_redirects` (old flat URLs → new paths).
- `build.mjs`: `pnpm build:site` writes `dist/site/` with `sitemap.xml` and
  `robots.txt`. `SITE_URL` overrides the canonical origin.

Deployed separately from the Worker, on Cloudflare Pages: build command
`node site/build.mjs`, output directory `dist/site`.
