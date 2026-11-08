import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { withRepoCopy } from "./repo-copy";

/**
 * Typecheck coverage guard (scripts/check-typecheck-coverage.ts).
 *
 * The script enumerates every .ts and .tsx file under apps/web/src and
 * packages/<name>/src and fails when one is a member of no checked project.
 * A file that no script or CI step reaches escapes silently, which is how
 * the never-exported @groot/ui tooltip component went unchecked. The guard
 * runs in CI as its own step, so a regression here reds the build, not just
 * a local run.
 */

const repoRoot = process.cwd();
const SCRIPT = path.join("scripts", "check-typecheck-coverage.ts");
const TIMEOUT = 120_000;

function runCoverageScript(checkedRepo = repoRoot): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("pnpm", ["exec", "tsx", path.join(checkedRepo, SCRIPT)], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: TIMEOUT,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("typecheck coverage", () => {
  it(
    "owns every source file at head",
    () => {
      const run = runCoverageScript();
      expect(run.status).toBe(0);
      // The count is a function of the tree, not a constant of the repo.
      // Matching N/N keeps the assertion true for any file count while
      // still requiring full coverage.
      expect(run.stdout).toMatch(/(\d+)\/\1 source files covered/);
    },
    TIMEOUT,
  );

  it(
    "typechecks repo-owned declarations",
    () =>
      withRepoCopy((root) => {
        writeFileSync(
          path.join(root, "packages/core/src/audit-broken.d.ts"),
          'declare module "__audit_broken__" {\n  export const broken: numbr;\n}\n',
        );
        const run = runCoverageScript(root);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain("packages/core/src/audit-broken.d.ts");
      }),
    TIMEOUT,
  );

  it(
    "names an unowned source file and nothing else in the copy",
    () =>
      withRepoCopy((root) => {
        writeFileSync(
          path.join(root, "packages/ui/src/orphan-coverage-probe.tsx"),
          "export function Orphan() {\n  return null;\n}\n",
        );
        const run = runCoverageScript(root);
        expect(run.status).toBe(1);
        expect(run.stderr.match(/not covered by any checked typecheck project: .*/g)).toEqual([
          "not covered by any checked typecheck project: packages/ui/src/orphan-coverage-probe.tsx",
        ]);
      }),
    TIMEOUT,
  );
});
