import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vite-plus/test";

/**
 * Changeset completeness gate (scripts/check-changesets.mjs).
 *
 * The gate turns release completeness from a convention into a check: a
 * branch that edits a managed surface (packages, apps/web/drizzle, .groot)
 * without a changeset or a recorded no-release reason fails the build. The
 * pure core runs here against fixture package trees, one with a changeset
 * and one without, asserting the pass and fail verdicts the CLI reports.
 */

const repoRoot = process.cwd();
const SCRIPT = path.join("scripts", "check-changesets.mjs");

type GateState = {
  managedPackages: string[];
  coveredPackages: string[];
  reason: string | null;
  changedManagedFiles: string[];
  unknownReleases: string[];
  workspacePackages: string[];
};

type Gate = {
  collect: (state: {
    rootDir?: string;
    changedFiles: string[];
    changedEntries?: { file: string; pkgJsonBefore?: string; pkgJsonAfter?: string }[];
    changesetFiles: { name: string; body: string; added: boolean }[];
    noReleaseReason?: string | null;
    workspacePackages: string[];
  }) => GateState;
  parseChangesetReleases: (body: string) => string[];
  isReleaseBotCommit: (commit: { name: string; email: string }) => boolean;
  evaluate: (state: GateState) => {
    status: number;
    out?: string;
    err?: string;
    missing?: string[];
  };
  pkgJsonChangeIsReleaseRelevant: (beforeJson: string, afterJson: string) => boolean;
};

async function loadGate(): Promise<Gate> {
  return (await import(pathToFileUrlStr())) as unknown as Gate;
}

function pathToFileUrlStr(): string {
  return "file://" + path.resolve(repoRoot, SCRIPT);
}

function fixtureTree(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "af15-changesets-"));
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(dir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
  return dir;
}

async function collectFixture(
  files: Record<string, string>,
  changedFiles: string[],
  changesetBodies: string[],
  noReleaseReason: string | null = null,
) {
  const dir = fixtureTree(files);
  try {
    const gate = await loadGate();
    return {
      state: gate.collect({
        rootDir: dir,
        changedFiles,
        changesetFiles: changesetBodies.map((body, i) => ({
          name: `cs-${i}.md`,
          body,
          added: true,
        })),
        noReleaseReason,
        workspacePackages: WORKSPACE,
      }),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runGate(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [SCRIPT, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const WORKSPACE = ["my-app", "@groot/core", "@groot/ui"];

const MERGED_BEFORE_BRANCH = {
  "package.json": JSON.stringify({ name: "my-app" }),
  "pnpm-workspace.yaml": 'minimumReleaseAge: 1440\npackages:\n  - "."\n  - "packages/*"\n',
  "packages/ui/package.json": JSON.stringify({ name: "@groot/ui" }),
  ".no-release/earlier.md": "# No release: an earlier branch\n",
  ".changeset/earlier.md": rootChangeset("my-app"),
};

const MIGRATION = { "apps/web/drizzle/meta/_journal.json": "{}\n" };

// branchFiles maps a path to its new content, or to null to delete it.
function branchFromMain(branchFiles: Record<string, string | null>): {
  dir: string;
  base: string;
} {
  const dir = fixtureTree(MERGED_BEFORE_BRANCH);
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Dev",
        "-c",
        "user.email=dev@example.com",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { cwd: dir, encoding: "utf8" },
    ).trim();
  git("init", "-q");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  for (const [rel, body] of Object.entries(branchFiles)) {
    if (body === null) {
      rmSync(path.join(dir, rel));
      continue;
    }
    mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "branch");
  return { dir, base };
}

function rootChangeset(name: string): string {
  return `---\n"${name}": patch\n---\n\nAdd a migration.\n`;
}

function runOnBranch(branchFiles: Record<string, string | null>) {
  const { dir, base } = branchFromMain(branchFiles);
  try {
    return runGate(["--root", dir, "--base", base]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CORE_PKG = JSON.stringify({ name: "@groot/core" });
const UI_PKG = JSON.stringify({ name: "@groot/ui" });

describe("changesets gate", () => {
  it("maps changed managed files to their packages", async () => {
    const { state } = await collectFixture(
      { "packages/core/package.json": CORE_PKG, "packages/ui/package.json": UI_PKG },
      [
        "packages/core/src/logger/index.ts",
        "packages/ui/src/button.tsx",
        "docs/guide.md",
        "apps/web/src/pages/Home.tsx",
      ],
      [],
    );
    expect(state.managedPackages).toEqual(["@groot/core", "@groot/ui"]);
    expect(state.changedManagedFiles).toEqual([
      "packages/core/src/logger/index.ts",
      "packages/ui/src/button.tsx",
    ]);
  }, 20_000);

  it("maps migration and .groot changes to the root package", async () => {
    const { state } = await collectFixture(
      { "package.json": JSON.stringify({ name: "my-app" }) },
      ["apps/web/drizzle/0000_init.sql", ".groot/lib/patterns.ts"],
      [],
    );
    expect(state.managedPackages).toEqual(["my-app"]);
  }, 20_000);

  it("in a child project, covers only its own migrations, not files synced from groot", async () => {
    const { state } = await collectFixture(
      {
        "package.json": JSON.stringify({ name: "my-app" }),
        ".groot/boilerplate-sync.json": JSON.stringify({ boilerplate: { name: "groot" } }),
        "packages/core/package.json": CORE_PKG,
      },
      [
        "packages/core/src/logger/index.ts",
        ".groot/lib/patterns.ts",
        ".groot/boilerplate-sync.json",
        "apps/web/drizzle/0003_add_tags.sql",
      ],
      [],
    );
    expect(state.managedPackages).toEqual(["my-app"]);
    expect(state.changedManagedFiles).toEqual(["apps/web/drizzle/0003_add_tags.sql"]);
  }, 20_000);

  it("accepts a migration changeset naming the root package.json name", () => {
    const run = runOnBranch({
      ...MIGRATION,
      ".changeset/migration.md": rootChangeset("my-app"),
    });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("my-app covered");
  }, 30_000);

  it("rejects a migration changeset naming groot and names the root package", () => {
    const run = runOnBranch({ ...MIGRATION, ".changeset/migration.md": rootChangeset("groot") });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      '.changeset/migration.md names unknown package "groot"; packages are: my-app, @groot/ui',
    );
    expect(run.stderr).toContain('use "my-app" for apps/web/drizzle and .groot changes');
  }, 30_000);

  it("rejects groot in a CRLF changeset with a none bump", () => {
    const run = runOnBranch({
      ...MIGRATION,
      ".changeset/migration.md":
        '---\r\n"my-app": patch\r\n"groot": none\r\n---\r\n\r\nMigrate.\r\n',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('.changeset/migration.md names unknown package "groot"');
  }, 30_000);

  it("does not count an edited or renamed reason merged before the branch", () => {
    const edited = runOnBranch({
      "packages/ui/src/button.tsx": "export {};\n",
      ".no-release/earlier.md": "# No release: an earlier branch, typo fixed\n",
    });
    expect(edited.status).toBe(1);
    expect(edited.stderr).toContain("missing changeset for @groot/ui");
    const renamed = runOnBranch({
      "packages/ui/src/button.tsx": "export {};\n",
      ".no-release/earlier.md": null,
      ".no-release/mine.md": MERGED_BEFORE_BRANCH[".no-release/earlier.md"],
    });
    expect(renamed.status).toBe(1);
    expect(renamed.stderr).toContain("missing changeset for @groot/ui");
  }, 30_000);

  it("rejects a changeset naming groot beside the root package", () => {
    const run = runOnBranch({
      ...MIGRATION,
      ".changeset/migration.md": '---\n"my-app": patch\n"groot": patch\n---\n\nMigrate.\n',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('.changeset/migration.md names unknown package "groot"');
    expect(run.stderr).not.toContain('unknown package "my-app"');
  }, 30_000);

  it("ignores reasons and changesets merged before the branch", () => {
    const run = runOnBranch(MIGRATION);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("missing changeset for my-app");
  }, 30_000);

  it("accepts the first non-empty no-release reason the branch adds", () => {
    const run = runOnBranch({
      ...MIGRATION,
      ".no-release/a-empty.md": "",
      ".no-release/mine.md": "# No release: internal\n",
    });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no-release reason accepted (mine.md");
  }, 30_000);

  it("passes when every changed package has its changeset", async () => {
    const gate = await loadGate();
    const { state } = await collectFixture(
      { "packages/core/package.json": CORE_PKG },
      ["packages/core/src/logger/index.ts"],
      ['---\n"@groot/core": patch\n---\n\nTune the logger.\n'],
    );
    expect(state.managedPackages).toEqual(["@groot/core"]);
    expect(state.coveredPackages).toEqual(["@groot/core"]);
    const verdict = gate.evaluate(state);
    expect(verdict.status).toBe(0);
    expect(verdict.out).toContain("@groot/core covered");
  }, 20_000);

  it("fails and names the package whose changeset is missing", async () => {
    const gate = await loadGate();
    const { state } = await collectFixture(
      { "packages/core/package.json": CORE_PKG, "packages/ui/package.json": UI_PKG },
      ["packages/core/src/logger/index.ts", "packages/ui/src/button.tsx"],
      ['---\n"@groot/core": patch\n---\n\nTune the logger.\n'],
    );
    expect(state.managedPackages).toEqual(["@groot/core", "@groot/ui"]);
    expect(state.coveredPackages).toEqual(["@groot/core"]);
    const verdict = gate.evaluate(state);
    expect(verdict.status).toBe(1);
    expect(verdict.missing).toEqual(["@groot/ui"]);
    expect(verdict.err).toContain("missing changeset for @groot/ui");
  }, 20_000);

  it("accepts a recorded no-release reason", async () => {
    const gate = await loadGate();
    const { state } = await collectFixture(
      { "packages/core/package.json": CORE_PKG },
      ["packages/core/src/logger/index.ts"],
      [],
      "internal-only.md: refactor, no public surface change",
    );
    expect(state.reason).toContain("internal-only.md");
    const verdict = gate.evaluate(state);
    expect(verdict.status).toBe(0);
    expect(verdict.out).toContain("no-release reason accepted");
  }, 20_000);

  it("parses frontmatter and detects the release bot", async () => {
    const gate = await loadGate();
    expect(gate.parseChangesetReleases('---\n"@groot/core": patch\n---\n')).toEqual([
      "@groot/core",
    ]);
    expect(gate.parseChangesetReleases("---\n'@groot/core': patch\n---\n")).toEqual([
      "@groot/core",
    ]);
    expect(gate.parseChangesetReleases('---\n"groot": patch\n"@groot/core": major\n---\n')).toEqual(
      ["groot", "@groot/core"],
    );
    // Prose that mimics frontmatter must not count as coverage.
    expect(gate.parseChangesetReleases("# Changesets\n\nHello and welcome!")).toEqual([]);
    expect(gate.parseChangesetReleases('---\n"groot": patch (draft)\n---\n')).toEqual([]);
    expect(
      gate.isReleaseBotCommit({
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
      }),
    ).toBe(true);
    expect(gate.isReleaseBotCommit({ name: "Ashik Nesin", email: "github@ashiknesin.com" })).toBe(
      false,
    );
  }, 20_000);

  it("reds when an exports-map edit has no changeset", async () => {
    const gate = await loadGate();
    const before = JSON.stringify({
      name: "@groot/core",
      version: "1.0.0",
      exports: { ".": "./src/index.ts" },
    });
    const after = JSON.stringify({
      name: "@groot/core",
      version: "1.0.0",
      exports: { ".": "./src/index.ts", "./feature-flags": "./src/feature-flags/index.ts" },
    });
    expect(gate.pkgJsonChangeIsReleaseRelevant(before, after)).toBe(true);
    const { state } = await collectFixture(
      { "packages/core/package.json": CORE_PKG },
      ["packages/core/package.json"],
      [],
    );
    // The CLI path reconstructs both blobs from the diff; simulate the same
    // release-relevant entry through collect with explicit blobs.
    const dir = fixtureTree({ "packages/core/package.json": after });
    try {
      const withBlobs = gate.collect({
        rootDir: dir,
        changedFiles: ["packages/core/package.json"],
        changedEntries: [
          { file: "packages/core/package.json", pkgJsonBefore: before, pkgJsonAfter: after },
        ],
        changesetFiles: [],
        noReleaseReason: null,
        workspacePackages: WORKSPACE,
      });
      expect(withBlobs.managedPackages).toEqual(["@groot/core"]);
      const verdict = gate.evaluate(withBlobs);
      expect(verdict.status).toBe(1);
      expect(verdict.err).toContain("missing changeset for @groot/core");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    void state;
  }, 20_000);

  it("ignores a version-only package.json bump", async () => {
    const gate = await loadGate();
    const before = JSON.stringify({
      name: "@groot/core",
      version: "1.0.0",
      exports: { ".": "./src/index.ts" },
    });
    const after = JSON.stringify({
      name: "@groot/core",
      version: "1.1.0",
      exports: { ".": "./src/index.ts" },
    });
    expect(gate.pkgJsonChangeIsReleaseRelevant(before, after)).toBe(false);
    const dir = fixtureTree({ "packages/core/package.json": after });
    try {
      const state = gate.collect({
        rootDir: dir,
        changedFiles: ["packages/core/package.json"],
        changedEntries: [
          { file: "packages/core/package.json", pkgJsonBefore: before, pkgJsonAfter: after },
        ],
        changesetFiles: [],
        noReleaseReason: null,
        workspacePackages: WORKSPACE,
      });
      expect(state.managedPackages).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("fails in one line naming the fetch when the base ref is not in the clone", () => {
    const { dir } = branchFromMain(MIGRATION);
    try {
      const run = runGate(["--root", dir, "--base", "origin/main"]);
      expect(run.status).toBe(1);
      expect(`${run.stdout}${run.stderr}`).toBe(
        "Base ref origin/main is not in this clone. Fetch the base: `git fetch origin main:refs/remotes/origin/main` or set fetch-depth: 0 in CI.\n",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 when the branch touches no managed surface", () => {
    const run = runGate(["--base", "HEAD"]);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no managed package surface changed");
  }, 30_000);
});
