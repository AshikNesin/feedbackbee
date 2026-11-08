import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SCRIPT = path.join(process.cwd(), "scripts", "check-migrations-immutable.mjs");
const DIR = "apps/web/drizzle";

const entry = (idx: number, tag: string) => ({ idx, version: "6", when: idx, tag });
const journal = (...entries: object[]) => `${JSON.stringify({ version: "7", entries })}\n`;

const APPLIED = {
  [`${DIR}/0000_init.sql`]: "CREATE TABLE `todos` (`id` text);\n",
  [`${DIR}/meta/0000_snapshot.json`]: "{}\n",
  [`${DIR}/meta/_journal.json`]: journal(entry(0, "0000_init")),
  [`${DIR}/index.ts`]: 'import m0 from "./0000_init.sql";\n',
};

const GIT_IDENTITY = [
  ["-c", "user.name=Dev"],
  ["-c", "user.email=dev@example.com"],
  ["-c", "commit.gpgsign=false"],
  ["-c", "core.hooksPath=/dev/null"],
].flat();

type Files = Record<string, string | null>;

function write(dir: string, files: Files) {
  for (const [rel, body] of Object.entries(files)) {
    if (body === null) {
      rmSync(path.join(dir, rel));
      continue;
    }
    mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
}

function runGate(branch: Files, { commit = true, base }: { commit?: boolean; base?: string } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "migrations-immutable-"));
  const git = (...args: string[]) =>
    execFileSync("git", [...GIT_IDENTITY, ...args], { cwd: dir, encoding: "utf8" }).trim();
  try {
    write(dir, APPLIED);
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "main");
    const main = git("rev-parse", "HEAD");
    write(dir, branch);
    if (commit) {
      git("add", "-A");
      git("commit", "-q", "-m", "branch");
    }
    const run = spawnSync("node", [SCRIPT, "--root", dir, "--base", base ?? main], {
      encoding: "utf8",
    });
    return { status: run.status, out: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("check-migrations-immutable", () => {
  it("passes a new migration that appends to the journal", () => {
    const { status } = runGate({
      [`${DIR}/0001_notes.sql`]: "CREATE TABLE `notes` (`id` text);\n",
      [`${DIR}/meta/0001_snapshot.json`]: "{}\n",
      [`${DIR}/meta/_journal.json`]: journal(entry(0, "0000_init"), entry(1, "0001_notes")),
    });
    expect(status).toBe(0);
  });

  it("lets the generated migration index change with a new migration", () => {
    const { status } = runGate({
      [`${DIR}/index.ts`]:
        'import m0 from "./0000_init.sql";\nimport m1 from "./0001_notes.sql";\n',
      [`${DIR}/0001_notes.sql`]: "CREATE TABLE `notes` (`id` text);\n",
      [`${DIR}/meta/_journal.json`]: journal(entry(0, "0000_init"), entry(1, "0001_notes")),
    });
    expect(status).toBe(0);
  });

  it("fails an edit to an applied migration and names the fix", () => {
    const { status, out } = runGate({
      [`${DIR}/0000_init.sql`]: "CREATE TABLE `todos` (`id` text, `note` text);\n",
    });
    expect(status).toBe(1);
    expect(out).toContain(`${DIR}/0000_init.sql edited after it was applied`);
    expect(out).toContain("add a new migration with `pnpm db:generate` instead");
  });

  it("fails an uncommitted edit, so a local run catches it before commit", () => {
    const { status } = runGate({ [`${DIR}/0000_init.sql`]: "-- edited\n" }, { commit: false });
    expect(status).toBe(1);
  });

  it("fails a deleted snapshot", () => {
    const { status, out } = runGate({ [`${DIR}/meta/0000_snapshot.json`]: null });
    expect(status).toBe(1);
    expect(out).toContain("0000_snapshot.json deleted");
  });

  it("fails in one line naming the fetch when the base ref is not in the clone", () => {
    const { status, out } = runGate({}, { commit: false, base: "origin/main" });
    expect(status).toBe(1);
    expect(out).toBe(
      "Base ref origin/main is not in this clone. Fetch the base: `git fetch origin main:refs/remotes/origin/main` or set fetch-depth: 0 in CI.\n",
    );
  });

  it("fails in one line naming the unshallow when a shallow clone holds no shared commit", () => {
    const origin = mkdtempSync(path.join(tmpdir(), "migrations-origin-"));
    const clone = mkdtempSync(path.join(tmpdir(), "migrations-shallow-"));
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", [...GIT_IDENTITY, ...args], { cwd, encoding: "utf8" });
    try {
      write(origin, APPLIED);
      git(origin, "init", "-q", "-b", "main");
      git(origin, "add", ".");
      git(origin, "commit", "-q", "-m", "main");
      git(origin, "checkout", "-q", "-b", "branch");
      git(origin, "commit", "-q", "--allow-empty", "-m", "branch");
      git(origin, "checkout", "-q", "main");
      git(origin, "commit", "-q", "--allow-empty", "-m", "main moves on");
      git(clone, "clone", "-q", "--depth", "1", "--branch", "branch", `file://${origin}`, ".");
      git(clone, "fetch", "-q", "--depth", "1", "origin", "main:refs/remotes/origin/main");

      const run = spawnSync("node", [SCRIPT, "--root", clone, "--base", "origin/main"], {
        encoding: "utf8",
      });
      expect(run.status).toBe(1);
      expect(`${run.stdout}${run.stderr}`).toBe(
        "This shallow clone holds no commit shared by HEAD and origin/main. Fetch the history: `git fetch --unshallow` or set fetch-depth: 0 in CI.\n",
      );
    } finally {
      rmSync(origin, { recursive: true, force: true });
      rmSync(clone, { recursive: true, force: true });
    }
  });

  it("fails a journal that rewrites an applied entry", () => {
    const { status, out } = runGate({
      [`${DIR}/meta/_journal.json`]: journal(entry(0, "0000_renamed")),
    });
    expect(status).toBe(1);
    expect(out).toContain("_journal.json edited");
    expect(out).toContain("keep the appended ones");
    expect(out).not.toContain("git checkout");
  });
});
