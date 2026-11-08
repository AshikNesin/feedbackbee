// The Tests workflow runs these through `pnpm verify:static`, so a gate added
// here runs locally and in CI.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MIGRATIONS_DIR = "apps/web/drizzle";

export const gates = [
  { name: "Typecheck (server)", run: "pnpm exec tsc --noEmit" },
  { name: "Typecheck (client)", run: "pnpm typecheck:client" },
  { name: "Typecheck (e2e tests)", run: "pnpm typecheck:e2e" },
  { name: "Typecheck coverage", run: "pnpm exec tsx scripts/check-typecheck-coverage.ts" },
  { name: "Typecheck kit consumers", run: "pnpm typecheck:kit" },
  // A child's own tsconfigs (e.g. a Workers test suite); groot defines none.
  { name: "Typecheck (app projects)", run: "pnpm run --if-present typecheck:app" },
  {
    name: "Kit export guard",
    run: "pnpm exec tsx scripts/check-kit-exports.ts --base origin/${GITHUB_BASE_REF:-main}",
  },
  { name: "Changeset gate", run: "pnpm check:changesets --base origin/${GITHUB_BASE_REF:-main}" },
  { name: "Checks coverage", run: "pnpm check:coverage" },
  { name: "Lint & format check", run: "pnpm check" },
  { name: "Doc references", run: "pnpm check:doc-refs" },
  { name: "Rule table", run: "pnpm exec tsx scripts/check-rule-table.ts" },
  { name: "Dead code", run: "pnpm check:dead" },
  { name: "Design tokens", run: "pnpm check:tokens" },
  { name: "pnpm policy", run: "pnpm check:pnpm-policy" },
  { name: "Migrations are up to date with the schema", run: migrationsMatchSchema },
  {
    name: "Applied migrations unchanged",
    run: "pnpm check:migrations-immutable --base origin/${GITHUB_BASE_REF:-main}",
  },
];

function sh(command) {
  return spawnSync(command, { shell: true, stdio: "inherit" }).status === 0;
}

function readTree(dir) {
  return new Map(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = path.join(entry.parentPath, entry.name);
        return [file, readFileSync(file, "utf8")];
      }),
  );
}

function restoreTree(dir, before) {
  const after = readTree(dir);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (file) => before.get(file) !== after.get(file),
  );
  for (const file of changed) {
    if (before.has(file)) writeFileSync(file, before.get(file));
    else unlinkSync(file);
  }
  return changed;
}

function migrationsMatchSchema() {
  const before = readTree(MIGRATIONS_DIR);
  const generated = sh("pnpm db:generate --name ci-check");
  const changed = restoreTree(MIGRATIONS_DIR, before);
  if (!generated) return false;
  if (changed.length === 0) return true;
  console.error(
    `Schema changed without a migration. Run 'pnpm db:generate' and commit ${MIGRATIONS_DIR}.`,
  );
  for (const file of changed) console.error(`  ${file}`);
  return false;
}

function runGates() {
  const inActions = process.env.GITHUB_ACTIONS === "true";
  for (const gate of gates) {
    console.log(inActions ? `::group::${gate.name}` : `\n▶ ${gate.name}`);
    const started = performance.now();
    const passed = typeof gate.run === "function" ? gate.run() : sh(gate.run);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (inActions) console.log("::endgroup::");
    if (!passed) {
      const rerun = typeof gate.run === "string" ? ` Rerun it alone with: ${gate.run}` : "";
      console.error(`${inActions ? "::error::" : ""}✗ ${gate.name} failed (${seconds}s).${rerun}`);
      process.exit(1);
    }
    console.log(`✓ ${gate.name} (${seconds}s)`);
  }
  console.log(`\nAll ${gates.length} static gates passed.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runGates();
