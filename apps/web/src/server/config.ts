import { defineConfig } from "@groot/core/config";

/**
 * App configuration. Anything not set here comes from `defaultConfig()` in
 * `@groot/core/config`, which derives sensible values from the environment
 * (`NODE_ENV`, `PORT`, `CORS_ALLOWED_ORIGINS`, `RP_*`, `LOG_LEVEL`, ...).
 *
 * FeedbackBee's own settings (GITHUB_TOKEN, MEDIA_BASE, DASHBOARD_BASE) are
 * read once at boot into `runtime.ts`.
 */
export const appConfig = defineConfig({
  app: { name: "FeedbackBee" },
  // No groot job queue: issues are filed inline while the submit request is open.
  jobs: { enabled: false },
});
