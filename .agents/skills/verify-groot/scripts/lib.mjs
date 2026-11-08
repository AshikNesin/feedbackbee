// Shared helpers for the verify-groot scripts. Not a CLI on its own.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The repo root: the scripts live in <root>/.agents/skills/verify-groot/scripts. */
export const ROOT = path.resolve(here, "../../../..");

/** Instance state (database, uploads, log, pid). Deleted by cleanup. */
export const stateDir = (run) => path.join(ROOT, "tmp/verify-groot", run);

/** Proof artifacts. Cleanup never touches this; `.screenshots/` is gitignored. */
export const evidenceDir = (run) => path.join(ROOT, ".screenshots/verify-groot", run);

export const instanceFile = (run) => path.join(stateDir(run), "instance.json");

export function requireRun(argv, usage) {
  const run = argv[0];
  if (!run || !/^[\w.-]+$/.test(run)) {
    console.error(`usage: ${usage}\n  <run> is a name made of letters, digits, '.', '_' or '-'`);
    process.exit(2);
  }
  return run;
}

/** The instance a run launched, or exit with a pointer to launch. */
export function readInstance(run) {
  const file = instanceFile(run);
  if (!existsSync(file)) {
    console.error(
      `no instance for run "${run}" (${path.relative(ROOT, file)} missing).\n` +
        `Launch one: node .agents/skills/verify-groot/scripts/launch.mjs ${run}`,
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

/** True while any process in the group is alive. */
export function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch {
    return false;
  }
}

/** PIDs listening on a TCP port, or null when lsof is not installed. */
export function listeners(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter(Boolean).map(Number);
  } catch (error) {
    // lsof exits 1 with no output when nothing listens.
    if (error.code === "ENOENT") return null;
    return [];
  }
}

/** Process group of a PID, or null if it has exited. */
export function pgidOf(pid) {
  try {
    return Number(
      execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" }).trim(),
    );
  } catch {
    return null;
  }
}

/** A fingerprint of the checkout: HEAD plus a hash of uncommitted changes. */
export function buildId() {
  const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  const head = git("rev-parse", "--short", "HEAD");
  const dirty = git("status", "--porcelain", "--untracked-files=no");
  if (!dirty) return head;
  const diff = execFileSync("git", ["diff", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  let hash = 0;
  for (let i = 0; i < diff.length; i++) hash = (hash * 31 + diff.charCodeAt(i)) | 0;
  return `${head}+dirty.${(hash >>> 0).toString(16)}`;
}

/** GET a JSON endpoint; resolves to { status, body } or { error }. */
export async function getJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON; keep the text
    }
    return { status: res.status, body };
  } catch (error) {
    return { error: error.cause?.code ?? error.message };
  }
}
