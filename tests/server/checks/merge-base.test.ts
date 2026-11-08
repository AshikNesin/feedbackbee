import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SCRIPT = path.join(process.cwd(), "scripts", "check-migrations-immutable.mjs");
const GIT_IDENTITY = [
  ["-c", "user.name=Dev"],
  ["-c", "user.email=dev@example.com"],
  ["-c", "commit.gpgsign=false"],
  ["-c", "core.hooksPath=/dev/null"],
].flat();

describe("a gate's base in a single-branch shallow clone", () => {
  it.each([
    ["main stays put", false],
    ["main moves on", true],
  ])("following each one-line fix makes the gate pass (%s)", (_, mainMoves) => {
    const origin = mkdtempSync(path.join(tmpdir(), "merge-base-origin-"));
    const clone = mkdtempSync(path.join(tmpdir(), "merge-base-clone-"));
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", [...GIT_IDENTITY, ...args], { cwd, encoding: "utf8" });
    try {
      writeFileSync(path.join(origin, "README.md"), "base\n");
      git(origin, "init", "-q", "-b", "main");
      git(origin, "add", ".");
      git(origin, "commit", "-q", "-m", "main");
      git(origin, "checkout", "-q", "-b", "branch");
      git(origin, "commit", "-q", "--allow-empty", "-m", "branch");
      if (mainMoves) {
        git(origin, "checkout", "-q", "main");
        git(origin, "commit", "-q", "--allow-empty", "-m", "main moves on");
      }
      git(clone, "clone", "-q", "--depth", "1", "--branch", "branch", `file://${origin}`, ".");

      const advice: string[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const run = spawnSync("node", [SCRIPT, "--root", clone, "--base", "origin/main"], {
          encoding: "utf8",
        });
        if (run.status === 0) break;
        expect(run.stderr.trim().split("\n")).toHaveLength(1);
        const command = /`(git [^`]+)`/.exec(run.stderr)?.[1];
        expect(command, run.stderr).toBeDefined();
        advice.push(command!);
        git(clone, ...command!.split(" ").slice(1));
      }
      expect(advice[0]).toBe("git fetch origin main:refs/remotes/origin/main");
      const final = spawnSync("node", [SCRIPT, "--root", clone, "--base", "origin/main"], {
        encoding: "utf8",
      });
      expect(final.status, `${final.stderr} after ${advice.join(", then ")}`).toBe(0);
    } finally {
      rmSync(origin, { recursive: true, force: true });
      rmSync(clone, { recursive: true, force: true });
    }
  });
});
