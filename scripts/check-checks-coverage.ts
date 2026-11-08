#!/usr/bin/env tsx
/**
 * Checks-coverage guard for the declared test ownership in
 * `.groot/lib/patterns.ts` (TEST_AREA_OWNERSHIP).
 *
 * Catches the two ways that map silently stops guarding:
 *
 *  1. An owned source root stops existing (renamed or deleted), so the map
 *     claims ownership of source that is no longer there.
 *  2. A declared test area stops existing or holds no tests. A renamed test
 *     area silently unschedules every suite under it — those tests fall to
 *     drift in sync — and nothing turns red.
 *
 * It also holds the static gates to one list, `scripts/gates.mjs`, so local
 * runs and CI can't drift apart:
 *
 *  3. The Tests workflow runs `pnpm verify:static`, and no other step of it
 *     runs a static check.
 *  4. Every `check:*` and `typecheck:*` package script is a gate, or a check
 *     the workflow runs after the build.
 *
 * Usage:  tsx scripts/check-checks-coverage.ts
 * Exit:   0 = covered, 1 = stale ownership entry or a check outside the gates.
 */
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import micromatch from "micromatch";
import { loadConfig } from "../.groot/lib/config";
import { ownedSourceRootsForTests, TEST_AREA_OWNERSHIP } from "../.groot/lib/patterns";
import { gates } from "./gates.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

const { additional_exclusions } = await loadConfig(ROOT);
const excludedFromSync = (dirOrRoot: string) =>
  micromatch.isMatch(dirOrRoot.replace(/\/\*\*$/, ""), additional_exclusions);

/** Expand a root pattern (may contain one `*` segment) to the dirs that exist. */
function expandRoot(root: string): string[] {
  if (!root.includes("*")) return existsSync(join(ROOT, root)) ? [root] : [];
  const parts = root.split("/");
  const starAt = parts.indexOf("*");
  const base = join(ROOT, ...parts.slice(0, starAt));
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((entry) => statSync(join(base, entry)).isDirectory())
    .map((entry) => [...parts.slice(0, starAt), entry, ...parts.slice(starAt + 1)].join("/"))
    .filter((dir) => existsSync(join(ROOT, dir)));
}

interface Failure {
  kind:
    | "root-missing"
    | "area-missing"
    | "area-empty"
    | "gates-not-in-ci"
    | "check-outside-gates"
    | "script-not-a-gate";
  detail: string;
}

const failures: Failure[] = [];

// --- 1. Owned source roots (what the synced test areas own) exist. --------
const ownedRoots = ownedSourceRootsForTests().filter((root) => !excludedFromSync(root));
for (const root of ownedRoots) {
  const dir = root.replace(/\/\*\*$/, "");
  if (expandRoot(dir).length === 0) {
    failures.push({
      kind: "root-missing",
      detail: `Owned source root "${root}" (from .groot/lib/patterns.ts TEST_AREA_OWNERSHIP) matches no directory on disk. Update the ownership map.`,
    });
  }
}

// --- 2. Every declared ownership area exists on disk and holds at least one
// test. Counting a test file (not "any file") keeps an area from being kept
// alive by its setup files alone.
function countTestFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countTestFiles(join(dir, entry.name));
    } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
      count += 1;
    }
  }
  return count;
}

const areas = Object.keys(TEST_AREA_OWNERSHIP).filter((area) => !excludedFromSync(area));
for (const area of areas) {
  if (!existsSync(join(ROOT, area))) {
    failures.push({
      kind: "area-missing",
      detail: `Declared test area "${area}" does not exist on disk. Rename or remove it in .groot/lib/patterns.ts TEST_AREA_OWNERSHIP — until then every suite under it classifies as drift in sync.`,
    });
    continue;
  }
  const tests = countTestFiles(area);
  if (tests === 0) {
    failures.push({
      kind: "area-empty",
      detail: `Declared test area "${area}" holds no test files. An area with no tests cannot own synced source; remove it from TEST_AREA_OWNERSHIP or add its suite.`,
    });
  }
}

// --- 3. The Tests workflow runs the gates, and only through gates.mjs. -----
const WORKFLOW = ".github/workflows/test.yml";
// Need `pnpm build` first: the closure reads the server bundle's metafile, and the
// wrangler dry run uploads dist/client as the Worker's assets.
const POST_BUILD_CHECKS = ["check:closure", "check:worker"];
const STATIC_CHECK =
  /\btsc\b|scripts\/check-[\w-]+|db:generate|\bpnpm ((?:check|typecheck)[\w:-]*)/g;

interface WorkflowStep {
  name?: string;
  run?: string;
}
const workflow = loadYaml(readFileSync(join(ROOT, WORKFLOW), "utf8")) as {
  jobs: Record<string, { steps?: WorkflowStep[] }>;
};
const runSteps = Object.values(workflow.jobs).flatMap((job) => {
  const steps = (job.steps ?? []).filter(
    (step): step is WorkflowStep & { run: string } => typeof step.run === "string",
  );
  const buildAt = steps.findIndex((step) => /\bpnpm build\b/.test(step.run));
  return steps.map((step, i) => ({ ...step, afterBuild: buildAt !== -1 && i > buildAt }));
});
const gateSteps = runSteps.filter((step) => step.run.trim() === "pnpm verify:static");
if (gateSteps.length !== 1) {
  failures.push({
    kind: "gates-not-in-ci",
    detail: `${WORKFLOW} has ${gateSteps.length} steps running \`pnpm verify:static\`. It needs exactly one, so CI runs every gate in scripts/gates.mjs.`,
  });
}
for (const step of runSteps) {
  if (gateSteps.includes(step)) continue;
  for (const match of step.run.matchAll(STATIC_CHECK)) {
    if (match[1] && POST_BUILD_CHECKS.includes(match[1])) continue;
    const fix =
      step.afterBuild && match[1]
        ? `If it needs \`pnpm build\` first, add "${match[1]}" to POST_BUILD_CHECKS in scripts/check-checks-coverage.ts. Otherwise move it to scripts/gates.mjs and delete the step.`
        : "Add it to scripts/gates.mjs and delete the step, so `pnpm verify:static` runs it locally too.";
    failures.push({
      kind: "check-outside-gates",
      detail: `${WORKFLOW} step "${step.name ?? step.run}" runs \`${match[0]}\` outside the static gates. ${fix}`,
    });
  }
}

// --- 4. Every check script is a gate. --------------------------------------
const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const gateCommands = gates.flatMap((gate) => (typeof gate.run === "string" ? [gate.run] : []));
for (const script of Object.keys(scripts)) {
  if (!/^(check|typecheck):/.test(script) || POST_BUILD_CHECKS.includes(script)) continue;
  if (
    !gateCommands.some((command) => command.split(" ").slice(0, 2).join(" ") === `pnpm ${script}`)
  ) {
    failures.push({
      kind: "script-not-a-gate",
      detail: `package.json script "${script}" is not a static gate, so neither CI nor \`pnpm verify:static\` runs it. Add { name, run: "pnpm ${script}" } to scripts/gates.mjs, or, if it needs \`pnpm build\` first, add "${script}" to POST_BUILD_CHECKS in scripts/check-checks-coverage.ts and run it after the build step in ${WORKFLOW}.`,
    });
  }
}

// --- Report. --------------------------------------------------------------
if (failures.length > 0) {
  console.error(
    `❌ Checks-coverage failed (${failures.length} gap${failures.length === 1 ? "" : "s"}):\n`,
  );
  for (const f of failures) {
    console.error(`  [${f.kind}] ${f.detail}`);
  }
  process.exit(1);
}

console.log(
  `✓ Checks covered: ${areas.length} declared test areas ` +
    `owning ${ownedRoots.length} source roots, all present on disk; ` +
    `${gates.length} static gates, all run by \`pnpm verify:static\` in ${WORKFLOW}.`,
);
process.exit(0);
