import { defineConfig } from "vite-plus";
import { availableParallelism } from "node:os";
import path from "node:path";

const rootDir = path.resolve();
// Most server test files wait on timers and child processes, not the CPU.
const WORKERS_PER_CORE = 2;

// Never reach real services from tests, whatever the shell exports: with real
// Pushover keys in the environment, notification tests can send actual
// test pushes (their fetch spy watches calls, it does not stop them). Remove the
// keys and model settings outright, matching CI, which sets none of them.
// Test workers inherit this process's environment.
for (const key of [
  "PUSHOVER_API_TOKEN",
  "PUSHOVER_USER_KEY",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_GATEWAY_ID",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "SENTRY_DSN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "COPILOT_GITHUB_TOKEN",
  "GEMINI_API_KEY",
]) {
  delete process.env[key];
}

export default defineConfig({
  root: ".",
  test: {
    include: ["tests/server/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/server/setup.ts"],
    maxWorkers: availableParallelism() * WORKERS_PER_CORE,
  },
  resolve: {
    alias: {
      "@groot/ai": path.resolve(rootDir, "packages/ai/src"),
      "@groot/core": path.resolve(rootDir, "packages/core/src"),
      "@groot/jobs/server": path.resolve(rootDir, "packages/jobs/src/server"),
    },
  },
});
