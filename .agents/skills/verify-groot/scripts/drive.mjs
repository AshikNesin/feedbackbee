#!/usr/bin/env node
// Drive one journey against a run's instance in headless Chromium and record proof.
//   node .agents/skills/verify-groot/scripts/drive.mjs <run> <journey.mjs> [--headed]
// Evidence: .screenshots/verify-groot/<run>/<journey>-<time>/
//   NN-<step>.png, NN-<step>.aria.yml   after every step
//   steps.md                            each action, its result, pass/fail
//   console.log                         browser console errors, 4xx/5xx responses
//   result.json                         { journey, ok, error, steps, build }
//   failure.png, failure.aria.yml       only when a step throws
//
// A journey is an ES module:
//   export const login = true;          // default; false starts logged out
//   export default async ({ page, step, expect, db, api, note }) => { ... };
// step(name, fn) runs fn and then captures the page. db(sql, ...params) runs a
// read-only query on the run's database (about 1 s each). api(path, init)
// calls the API with the browser's session cookie. note(text) adds a line to
// steps.md.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { ROOT, readInstance, requireRun } from "./lib.mjs";

const args = process.argv.slice(2);
const run = requireRun(args, "drive.mjs <run> <journey.mjs> [--headed]");
const journeyPath = args[1];
if (!journeyPath) {
  console.error("usage: drive.mjs <run> <journey.mjs> [--headed]");
  process.exit(2);
}
const inst = readInstance(run);
const journey = await import(pathToFileURL(path.resolve(journeyPath)).href);
const name = path.basename(journeyPath).replace(/\.m?js$/, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.join(inst.evidenceDir, `${name}-${stamp}`);
mkdirSync(out, { recursive: true });

const md = (line) => appendFileSync(path.join(out, "steps.md"), line + "\n");
const consoleLog = (line) => appendFileSync(path.join(out, "console.log"), line + "\n");
md(
  `# ${name}\n\nrun \`${run}\` · ${inst.baseURL} · build \`${inst.build}\` · ${new Date().toISOString()}\n`,
);

// Read-only queries go through scripts/db.ts (the app's own database layer).
const db = (sql, ...params) => {
  const res = spawnSync(
    path.join(ROOT, "node_modules/.bin/tsx"),
    [path.join(ROOT, ".agents/skills/verify-groot/scripts/db.ts"), run, sql, ...params.map(String)],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(`db(${JSON.stringify(sql)}) failed: ${res.stderr.trim()}`);
  return JSON.parse(res.stdout);
};

// VERIFY_CHROMIUM_PATH: a Chromium binary to use when the one matching the
// repo's Playwright is not installed (e.g. a container with a preinstalled
// browser for another Playwright version).
let browser;
try {
  browser = await chromium.launch({
    headless: !args.includes("--headed"),
    executablePath: process.env.VERIFY_CHROMIUM_PATH || undefined,
  });
} catch (e) {
  if (!String(e.message).includes("Executable doesn't exist")) throw e;
  console.error(
    "Chromium for this repo's Playwright is not installed. Either run\n" +
      "  pnpm exec playwright install chromium\n" +
      "or point VERIFY_CHROMIUM_PATH at an existing Chromium binary.",
  );
  process.exit(1);
}
const context = await browser.newContext({
  baseURL: inst.baseURL,
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleLog(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => consoleLog(`[pageerror] ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400) consoleLog(`[http ${r.status()}] ${r.request().method()} ${r.url()}`);
});

const api = async (urlPath, init = {}) => {
  const res = await context.request.fetch(urlPath, {
    method: init.method ?? "GET",
    data: init.body,
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status(), body };
};

let n = 0;
const steps = [];
async function capture(prefix) {
  await page.screenshot({ path: path.join(out, `${prefix}.png`), fullPage: true });
  writeFileSync(path.join(out, `${prefix}.aria.yml`), await page.locator("body").ariaSnapshot());
}
async function step(label, fn) {
  const id = `${String(++n).padStart(2, "0")}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const result = await fn();
  await capture(id);
  const detail = result === undefined ? "" : ` → ${JSON.stringify(result)}`;
  md(`- **${label}** ok (url \`${new URL(page.url()).pathname}\`)${detail} · \`${id}.png\``);
  steps.push({ id, label, ok: true });
  return result;
}
const note = (text) => md(`  - ${text}`);

let error = null;
try {
  if (journey.login !== false) {
    await step("log in as demo user", async () => {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill("demo@example.com");
      await page.getByLabel(/password/i).fill("demo@example.com");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.waitForURL(/\/todos$/);
    });
  }
  await journey.default({ page, step, expect, db, api, note });
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
  md(`- **FAILED** ${error.split("\n")[0]}`);
  await capture("failure").catch(() => undefined);
}

await browser.close();
const ok = error === null;
writeFileSync(
  path.join(out, "result.json"),
  JSON.stringify({ journey: name, ok, error, steps, build: inst.build }, null, 2) + "\n",
);
md(`\n**${ok ? "PASS" : "FAIL"}**`);
console.log(`${ok ? "PASS" : "FAIL"} ${name}${error ? `: ${error.split("\n")[0]}` : ""}`);
console.log(`evidence: ${path.relative(ROOT, out)}/`);
process.exit(ok ? 0 : 1);
