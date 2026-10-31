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
      singleWorker: true,
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          GITHUB_TOKEN: "ghp_testtoken1234567890abcdefgh", // gitleaks:allow (fake, GitHub is stubbed)
          LOG_LEVEL: "silent",
          // A dashboard allow-list must not affect the public submit endpoint.
          CORS_ALLOWED_ORIGINS: "https://dashboard.feedbackbee.test",
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
