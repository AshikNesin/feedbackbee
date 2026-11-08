#!/usr/bin/env node
// Stop the instance a run launched and delete its state. Keeps the evidence.
//   node .agents/skills/verify-groot/scripts/cleanup.mjs <run>
// Kills only the process group recorded at launch, never by name or port.
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT, evidenceDir, groupAlive, instanceFile, requireRun, stateDir } from "./lib.mjs";

const run = requireRun(process.argv.slice(2), "cleanup.mjs <run>");
const state = stateDir(run);

if (existsSync(instanceFile(run))) {
  const { pgid } = JSON.parse(readFileSync(instanceFile(run), "utf8"));
  if (groupAlive(pgid)) {
    process.kill(-pgid, "SIGTERM");
    const deadline = Date.now() + 10_000;
    while (groupAlive(pgid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    if (groupAlive(pgid)) process.kill(-pgid, "SIGKILL");
    console.log(`stopped process group ${pgid}`);
  } else {
    console.log(`process group ${pgid} already gone`);
  }
} else if (existsSync(state)) {
  console.log(`no instance.json in ${path.relative(ROOT, state)}; nothing to stop`);
} else {
  console.log(`no state for run "${run}"`);
}

rmSync(state, { recursive: true, force: true });
console.log(`removed ${path.relative(ROOT, state)}`);

const evidence = evidenceDir(run);
if (existsSync(evidence)) {
  const count = readdirSync(evidence, { recursive: true }).length;
  console.log(`kept evidence: ${path.relative(ROOT, evidence)}/ (${count} entries)`);
}
