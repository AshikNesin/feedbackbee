// An absolute core.hooksPath to one checkout's .vite-hooks/_ makes every git
// worktree run that checkout's hook scripts, and `vp config` then skips the
// worktree as "already set". The relative path git resolves per worktree.
// Runs from `prepare`, before `vp config`.

import { spawnSync } from "node:child_process";

const RELATIVE = ".vite-hooks/_";

const current = spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], {
  encoding: "utf8",
});
const value = current.status === 0 ? current.stdout.trim() : "";
if (value.startsWith("/") && value.endsWith(`/${RELATIVE}`)) {
  spawnSync("git", ["config", "--local", "core.hooksPath", RELATIVE], { stdio: "inherit" });
  console.log(`core.hooksPath: ${value} -> ${RELATIVE}`);
}
