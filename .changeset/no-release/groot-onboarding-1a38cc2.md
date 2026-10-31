# No release: FeedbackBee onboarded onto groot 1a38cc2

The groot kit (`packages/*`, `.groot/`, root configs, `scripts/`, `docs/`) is
imported as-is from groot 1a38cc2, plus the `uploadPaths` option in
`packages/core/src/app.ts` (and its test), made in groot first (changeset
`upload-paths.md` there) and copied here without divergence. FeedbackBee's own
code moved into `apps/web/`; `apps/web/drizzle/0000_init.sql` is a fresh
baseline (no pre-groot data is carried over).
