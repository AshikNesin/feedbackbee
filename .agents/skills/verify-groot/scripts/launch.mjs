#!/usr/bin/env node
// Start an isolated Groot dev server for one verification run.
//   node .agents/skills/verify-groot/scripts/launch.mjs <run> [--port 3100]
// Fresh SQLite file and uploads folder under tmp/verify-groot/<run>/, migrations
// and the demo seed applied, then waits until the app is usable.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ROOT,
  buildId,
  evidenceDir,
  getJson,
  instanceFile,
  listeners,
  requireRun,
  stateDir,
} from "./lib.mjs";

const args = process.argv.slice(2);
const run = requireRun(args, "launch.mjs <run> [--port <port>]");
const portFlag = args.indexOf("--port");
const port = portFlag === -1 ? 3100 : Number(args[portFlag + 1]);
if (!Number.isInteger(port) || port < 1024) {
  console.error(`invalid --port ${args[portFlag + 1]}`);
  process.exit(2);
}

if (existsSync(instanceFile(run))) {
  console.error(
    `run "${run}" already has an instance. Check it with doctor.mjs ${run}, ` +
      `or remove it with cleanup.mjs ${run}.`,
  );
  process.exit(1);
}
if (!existsSync(path.join(ROOT, "node_modules/.bin/tsx"))) {
  console.error("dependencies missing: run `pnpm install` at the repo root first");
  process.exit(1);
}

// The dev server takes PORT for HTTP and PORT+1 for Vite's HMR websocket.
for (const p of [port, port + 1]) {
  const owners = listeners(p);
  if (owners === null) {
    console.warn(`warning: lsof not installed, cannot check whether port ${p} is free`);
  } else if (owners.length > 0) {
    console.error(
      `port ${p} is in use (pid ${owners.join(", ")}). It is not ours: pick another ` +
        `with --port, never kill it.`,
    );
    process.exit(1);
  }
}

const state = stateDir(run);
mkdirSync(path.join(state, "uploads"), { recursive: true });
mkdirSync(evidenceDir(run), { recursive: true });
const dbFile = path.join(state, "app.db");
const logFile = path.join(state, "server.log");
const baseURL = `http://localhost:${port}`;

const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: String(port),
  DATABASE_URL: `file:${dbFile}`,
  UPLOADS_DIR: path.join(state, "uploads"),
  ORIGIN: baseURL,
  RP_ID: "localhost",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  // Same thread caps scripts/dev.ts sets, so Vite's bundler stays small.
  ROLLDOWN_MAX_BLOCKING_THREADS: "8",
  ROLLDOWN_WORKER_THREADS: "2",
  TOKIO_WORKER_THREADS: "2",
  RAYON_NUM_THREADS: "2",
};
// Never inherit a tunnel or portless URL: HMR must stay on PORT+1.
delete env.VITE_HMR_URL;
delete env.PORTLESS_URL;

const tsx = path.join(ROOT, "node_modules/.bin/tsx");

console.log(`seeding ${path.relative(ROOT, dbFile)} (migrations + demo user + 3 todos)`);
const seed = spawnSync(tsx, ["scripts/seed.ts"], { cwd: ROOT, env, stdio: "inherit" });
if (seed.status !== 0) {
  console.error("seed failed; see output above");
  process.exit(1);
}

const log = openSync(logFile, "a");
// detached: the server leads its own process group, so cleanup kills exactly
// what this launch started (tsx and the node child it spawns).
const child = spawn(tsx, ["apps/web/src/server/entry.node.ts"], {
  cwd: ROOT,
  env,
  detached: true,
  stdio: ["ignore", log, log],
});
child.unref();

const instance = {
  run,
  baseURL,
  port,
  hmrPort: port + 1,
  pgid: child.pid,
  dbFile,
  uploadsDir: env.UPLOADS_DIR,
  logFile,
  evidenceDir: evidenceDir(run),
  build: buildId(),
  startedAt: new Date().toISOString(),
};
writeFileSync(instanceFile(run), JSON.stringify(instance, null, 2) + "\n");
console.log(`started pgid ${child.pid}, log ${path.relative(ROOT, logFile)}`);

// Ready means usable: the API answers ready, the demo user exists, and Vite
// serves the SPA shell with the client entry.
const deadline = Date.now() + 120_000;
let last = "";
while (Date.now() < deadline) {
  if (child.exitCode !== null) break;
  const ready = await getJson(`${baseURL}/ready`);
  const setup = await getJson(`${baseURL}/api/v1/auth/setup`);
  const shell = await getJson(`${baseURL}/login`);
  last = JSON.stringify({ ready: ready.body ?? ready.error, setup: setup.body ?? setup.error });
  if (
    ready.body?.ready === true &&
    setup.body?.data?.needsSetup === false &&
    typeof shell.body === "string" &&
    shell.body.includes("/src/client/main.tsx")
  ) {
    console.log(`READY ${baseURL} (run "${run}", build ${instance.build})`);
    console.log(`evidence goes in ${path.relative(ROOT, instance.evidenceDir)}/`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error(`not ready after 120s. Last probe: ${last}. Tail of ${logFile}:`);
spawnSync("tail", ["-n", "40", logFile], { stdio: "inherit" });
console.error(`clean up with: node .agents/skills/verify-groot/scripts/cleanup.mjs ${run}`);
process.exit(1);
