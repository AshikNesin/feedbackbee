// FeedbackBee's integration suite: runs inside workerd (the real Workers
// runtime) via Miniflare against the production entry, with a local D1 and R2.
// Fully local: no Cloudflare account; GitHub is stubbed with MSW
// (tests/worker/gh-server.ts). App-owned (listed in
// .groot/boilerplate-sync.json additional_exclusions); groot's Node suites run
// from vitest.config.server.ts.
import path from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const rootDir = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./apps/web/src/server/entry.worker.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          FEEDBACKBEE_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          LOG_LEVEL: "silent",
          // A dashboard allow-list must not affect the public submit endpoint.
          CORS_ALLOWED_ORIGINS: "https://dashboard.feedbackbee.test",
          // Fake Pushover keys: notifications are on, and gh-server.ts stubs Pushover.
          PUSHOVER_USER_KEY: "test-pushover-user", // gitleaks:allow (fake)
          PUSHOVER_API_TOKEN: "test-pushover-token", // gitleaks:allow (fake)
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@groot/core": path.resolve(rootDir, "packages/core/src"),
    },
  },
  test: {
    include: ["tests/worker/**/*.test.ts"],
    setupFiles: ["./tests/worker/apply-migrations.ts"],
  },
});
