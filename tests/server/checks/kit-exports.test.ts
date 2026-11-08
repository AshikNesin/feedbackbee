import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { withRepoCopy } from "./repo-copy";

/**
 * Kit export guard (scripts/check-kit-exports.ts).
 *
 * The script keeps the explicit exports maps of @groot/ui and @groot/jobs in
 * agreement with their source files and with the imports of the compiled
 * consumer fixture. A new module, a removed subpath, or a fixture that stops
 * exercising a subpath must fail a check, because the fixture is what forces
 * the removal deliberation recorded in AGENTS.md.
 */

const repoRoot = process.cwd();
const SCRIPT = path.join("scripts", "check-kit-exports.ts");
const TIMEOUT = 60_000;
const GIT_IDENTITY = [
  ["-c", "user.name=Dev"],
  ["-c", "user.email=dev@example.com"],
  ["-c", "commit.gpgsign=false"],
  ["-c", "core.hooksPath=/dev/null"],
].flat();

function runGuard(
  checkedRepo = repoRoot,
  args: string[] = [],
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("pnpm", ["exec", "tsx", path.join(checkedRepo, SCRIPT), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: TIMEOUT,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("kit exports guard", () => {
  it(
    "agrees with the fixture at head",
    () => {
      const run = runGuard();
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("kit exports and consumer fixture agree");
    },
    TIMEOUT,
  );

  it(
    "fails when an exports entry loses its fixture import",
    () =>
      withRepoCopy((root) => {
        const fixture = path.join(root, "tests/kit-consumers/consumer.tsx");
        const original = fs.readFileSync(fixture, "utf8");
        // Drop one barrel import so the "." entry stops being exercised.
        const withoutBarrelImport = original.replace(
          /import \{ Button as ButtonFromBarrel[^\n]*\n/,
          "",
        );
        expect(withoutBarrelImport).not.toBe(original);
        fs.writeFileSync(fixture, withoutBarrelImport);
        const run = runGuard(root);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain("public but the kit fixture never imports it");
      }),
    TIMEOUT,
  );

  it(
    "fails when a source module has no exports entry",
    () =>
      withRepoCopy((root) => {
        fs.writeFileSync(
          path.join(root, "packages/ui/src/kit-guard-probe.tsx"),
          "export function KitGuardProbe() {\n  return null;\n}\n",
        );
        const run = runGuard(root);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain("kit-guard-probe");
      }),
    TIMEOUT,
  );

  it(
    "fails when a named export on the merge base is removed, unless the removal is approved",
    () =>
      withRepoCopy((root) => {
        const git = (...args: string[]) =>
          execFileSync("git", [...GIT_IDENTITY, ...args], { cwd: root, encoding: "utf8" });
        fs.writeFileSync(path.join(root, ".gitignore"), "node_modules\n");
        git("init", "-q");
        git("add", "-A");
        git("commit", "-q", "-m", "main");
        const breadcrumb = path.join(root, "packages/ui/src/breadcrumb.tsx");
        const original = fs.readFileSync(breadcrumb, "utf8");
        const removed = original.replace(/^ {2}BreadcrumbEllipsis,\n/m, "");
        expect(removed).not.toBe(original);
        fs.writeFileSync(breadcrumb, removed);

        const run = runGuard(root, ["--base", "HEAD"]);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain('@groot/ui/breadcrumb: export "BreadcrumbEllipsis"');
        expect(run.stderr).toContain("deprecate it in a minor release");

        const approve = (...entries: Record<string, string>[]) => {
          fs.writeFileSync(
            path.join(root, "scripts/kit-export-removals.json"),
            JSON.stringify(entries.map((e) => ({ name: "BreadcrumbEllipsis", reason: "t", ...e }))),
          );
          return runGuard(root, ["--base", "HEAD"]);
        };
        const barrel = { subpath: "@groot/ui" };

        const barrelOnly = approve(barrel);
        expect(barrelOnly.status).toBe(1);
        expect(barrelOnly.stderr).toContain('"subpath": "@groot/ui/breadcrumb"');

        const packageKeyed = approve(barrel, { package: "@groot/ui" });
        expect(packageKeyed.status).toBe(1);
        expect(packageKeyed.stderr).toContain("names no kit subpath");

        expect(approve(barrel, { subpath: "@groot/ui/breadcrumb" }).status).toBe(0);
        expect(approve(barrel, { subpath: "@groot/ui/breadcrumb", until: "99.0.0" }).status).toBe(
          0,
        );
        expect(
          approve(barrel, { subpath: "@groot/ui/breadcrumb", until: "2999-01-01" }).status,
        ).toBe(0);

        const shipped = approve(barrel, { subpath: "@groot/ui/breadcrumb", until: "0.1.0" });
        expect(shipped.status).toBe(1);
        expect(shipped.stderr).toContain(
          'entry "BreadcrumbEllipsis" of @groot/ui/breadcrumb expired at 0.1.0',
        );
        expect(shipped.stderr).toContain("delete the entry from scripts/kit-export-removals.json");

        const pastDate = approve(barrel, { subpath: "@groot/ui/breadcrumb", until: "2000-01-01" });
        expect(pastDate.status).toBe(1);
        expect(pastDate.stderr).toContain("expired at 2000-01-01 (today is");

        fs.writeFileSync(path.join(root, "scripts/kit-export-removals.json"), "[]");
        const missingBase = runGuard(root, ["--base", "origin/main"]);
        expect(missingBase.status).toBe(1);
        expect(missingBase.stderr).toBe(
          "Base ref origin/main is not in this clone. Fetch the base: `git fetch origin main:refs/remotes/origin/main` or set fetch-depth: 0 in CI.\n",
        );
      }),
    TIMEOUT * 4,
  );

  it(
    "fails when the exports map reintroduces a wildcard",
    () =>
      withRepoCopy((root) => {
        const manifest = path.join(root, "packages/jobs/package.json");
        const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
        pkg.exports["./*"] = "./src/*";
        fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
        const run = runGuard(root);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain('wildcard export "./*"');
      }),
    TIMEOUT,
  );
});
