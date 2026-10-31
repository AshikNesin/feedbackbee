# site/

The FeedbackBee website, laid out like 404less's `site/`. Static HTML assembled
by one script; no framework. The Worker serves it at `/`; the dashboard is at `/app`.

- `layout.html`: the shared shell (head, nav, footer). Placeholders `{{title}}`,
  `{{description}}`, `{{ogDescription}}`, `{{canonical}}`, `{{ogImage}}`,
  `{{jsonld}}`, `{{content}}`.
- `pages/*.html`: one file per page, starting with a `<!--meta {json}-->` block
  (`path`, `title`, `description`, optional `ogDescription`, `og`, `noindex`).
- `assets/`: copied as-is to the output root. `site.css` and `site.js` (the whole
  look and the small page script), `img/`, `og/` (1200×630 social card), `demo/`
  (the product demo: `demo-music.*` plays on the page muted with a sound toggle,
  `demo.*` is the same cut without audio for sharing; recorded with Playwright
  against the real widget, only the submit response mocked), plus
  the `_headers` and `_redirects` files Static Assets read (old flat URLs → new paths).
- `build.mjs`: runs after the SPA build (`pnpm build:client` = `vp build && node site/build.mjs`),
  writes the pages into `dist/client/` with `sitemap.xml` and `robots.txt`, and renames
  the SPA's `index.html` to `app.html`. `SITE_URL` overrides the canonical origin.

Routing (`apps/web/src/server/worker/static-assets.ts`): `/` and `/<page>` →
`<page>.html`, `/app/*` → `app.html`, anything else → `404.html` with a 404 status.
