#!/usr/bin/env tsx
/**
 * Fails when the rule table in AGENTS.md names a lint rule id that
 * scripts/lint/boundaries.ts does not enforce, or when an enforced id has no
 * row, so the table and the lint rules cannot drift apart. Paths and `pnpm`
 * scripts in the table are check:doc-refs' job.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { enforcedRuleIds } from "./lint/boundaries";

const AGENTS = "AGENTS.md";
const BOUNDARIES = "scripts/lint/boundaries.ts";
const TABLE = "## Rules and their enforcers";
const RULE_ID = /\bR\d+[a-z]?\b/g;

export function ruleTableProblems(agents: string, enforced: ReadonlySet<string>): string[] {
  const lines = agents.split("\n");
  const start = lines.indexOf(TABLE);
  if (start === -1) return [`${AGENTS} has no "${TABLE}" section.`];
  const named = new Set<string>();
  const problems: string[] = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) {
    if (!lines[i].startsWith("|")) continue;
    const [, rule, enforcer = ""] = lines[i].split("|").map((cell) => cell.trim());
    for (const [id] of enforcer.matchAll(RULE_ID)) {
      named.add(id);
      if (!enforced.has(id)) {
        problems.push(
          `${AGENTS}:${i + 1} row "${rule}" names ${id}, which no enabled rule in ${BOUNDARIES} has as its id. Fix the id, or add the rule there.`,
        );
      }
    }
  }
  for (const id of enforced) {
    if (!named.has(id)) {
      problems.push(
        `${BOUNDARIES} enforces ${id}, which no row of the ${AGENTS} rule table names. Add ${id} to the row of the rule it enforces, or delete the lint rule.`,
      );
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const problems = ruleTableProblems(
    readFileSync(path.join(root, AGENTS), "utf8"),
    enforcedRuleIds,
  );
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log(`rule table: ${enforcedRuleIds.size} lint rule ids match ${BOUNDARIES}`);
}
