#!/usr/bin/env node
// Read-only: is this run's instance worth driving?
//   node .agents/skills/verify-groot/scripts/doctor.mjs <run>
// Exit 0 when every check passes, 1 otherwise. Never logs in (login is rate
// limited), never writes.
import { existsSync } from "node:fs";
import {
  buildId,
  getJson,
  groupAlive,
  listeners,
  pgidOf,
  readInstance,
  requireRun,
} from "./lib.mjs";

const run = requireRun(process.argv.slice(2), "doctor.mjs <run>");
const inst = readInstance(run);
let failed = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed++;
};

check(groupAlive(inst.pgid), "process group alive", `pgid ${inst.pgid}`);

const owners = listeners(inst.port);
if (owners === null) {
  console.log(`skip port owner check: lsof not installed`);
} else {
  const ours = owners.filter((pid) => pgidOf(pid) === inst.pgid);
  check(
    ours.length > 0,
    `port ${inst.port} owned by this run`,
    owners.length ? `listeners ${owners.join(", ")}` : "nothing listening",
  );
}

const ready = await getJson(`${inst.baseURL}/ready`);
check(ready.body?.ready === true, "/ready", JSON.stringify(ready.body ?? ready.error));

const setup = await getJson(`${inst.baseURL}/api/v1/auth/setup`);
check(
  setup.body?.data?.needsSetup === false,
  "demo user seeded (setup closed)",
  JSON.stringify(setup.body ?? setup.error),
);

check(existsSync(inst.dbFile), "run database exists", inst.dbFile);

const now = buildId();
check(
  now === inst.build,
  "checkout matches the launched build",
  now === inst.build
    ? now
    : `launched ${inst.build}, checkout now ${now}. The server does not reload: cleanup and relaunch`,
);

console.log(failed ? `\n${failed} check(s) failed` : `\nhealthy: ${inst.baseURL}`);
process.exit(failed ? 1 : 0);
