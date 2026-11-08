import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

/**
 * Checks-coverage guard (scripts/check-checks-coverage.ts). A test area the
 * project opted out of in `.groot/boilerplate-sync.json` additional_exclusions
 * is intentionally absent, so it is skipped rather than reported as missing.
 */

const SCRIPT = path.join("scripts", "check-checks-coverage.ts");

describe("checks coverage", () => {
  it("passes at head and skips test areas excluded from sync", () => {
    const run = spawnSync("pnpm", ["exec", "tsx", SCRIPT], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(run.stderr ?? "").not.toMatch(/area-missing/);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/Skipped \(additional_exclusions\): .*tests\/server\/jobs/);
  }, 60_000);
});
