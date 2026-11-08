// The commit a gate diffs against. CI and local clones can lack the base ref
// (a shallow clone, origin never fetched), so a gate that diffs against a base
// resolves it here and fails with the fix instead of a git stack trace.

import { spawnSync } from "node:child_process";
import process from "node:process";

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

// An explicit destination, because a single-branch clone (`--depth 1`) only
// fills FETCH_HEAD on `git fetch origin main`.
function fetchCommand(ref) {
  const slash = ref.indexOf("/");
  if (slash === -1) return `git fetch origin ${ref}`;
  const [remote, branch] = [ref.slice(0, slash), ref.slice(slash + 1)];
  return `git fetch ${remote} ${branch}:refs/remotes/${remote}/${branch}`;
}

/** Why `ref` has no merge base with HEAD, as one line naming the fix. */
function missingBaseMessage(ref, cwd) {
  const known = git(cwd, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status === 0;
  if (!known) {
    return `Base ref ${ref} is not in this clone. Fetch the base: \`${fetchCommand(ref)}\` or set fetch-depth: 0 in CI.`;
  }
  const shallow = git(cwd, "rev-parse", "--is-shallow-repository").stdout.trim() === "true";
  if (shallow) {
    return `This shallow clone holds no commit shared by HEAD and ${ref}. Fetch the history: \`git fetch --unshallow\` or set fetch-depth: 0 in CI.`;
  }
  return `HEAD shares no history with ${ref}. Pass the branch this one started from with \`--base <ref>\`.`;
}

/** The merge base of `ref` and HEAD. Exits 1 with one line naming the fix when there is none. */
export function mergeBase(ref, cwd = process.cwd()) {
  const found = git(cwd, "merge-base", ref, "HEAD");
  if (found.status === 0) return found.stdout.trim();
  console.error(missingBaseMessage(ref, cwd));
  process.exit(1);
}
