#!/usr/bin/env tsx
/**
 * Supply-chain policy guard for pnpm-workspace.yaml.
 *
 * Encodes the repo's hardening policy as a build failure instead of a
 * convention, so it cannot be quietly weakened in a merge or a bulk config
 * edit:
 *
 *  1. `minimumReleaseAge` and `trustPolicy` must be present with their
 *     agreed values. trustPolicy: no-downgrade refuses packages whose
 *     provenance/signature trust weakens between resolutions; the
 *     release-age gate blocks same-day publish-malware-then-unpublish
 *     attacks.
 *  2. `trustPolicyExclude` entries must be exact `name@version` pins. A
 *     wildcard entry (bare `name`, `name@*`, range) exempts every present
 *     and future version of a package — that is the weakening this check
 *     exists to prevent.
 *
 * YAML is parsed with a line scanner rather than a YAML library because the
 * workspace file is flat at the keys we guard and this keeps the check
 * dependency-free (it must run before any install that could add one).
 *
 * Usage:  pnpm check:pnpm-policy
 * Exit:   0 = policy intact, 1 = weakened or malformed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const EXPECTED = {
  minimumReleaseAge: "1440",
  trustPolicy: "no-downgrade",
} as const;

export interface Failure {
  key: string;
  problem: string;
}

/** Exact `name@version` pin: a bare name, `@*`, or a range widens the hole. */
const EXACT_PIN = /^[\w@/.-]+@\d+[^\s,]*$/;

/**
 * Pure verdict over the workspace file's text. Exported for tests.
 */
export function evaluatePolicy(yaml: string): Failure[] {
  const failures: Failure[] = [];
  const lines = yaml.split(/\r?\n/);

  // Top-level `key: value` entries; blank lines and comments fall through.
  const entries = new Map<string, string>(
    lines
      .map((line) => /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]] as const),
  );

  for (const [key, expected] of Object.entries(EXPECTED)) {
    const actual = entries.get(key) ?? null;
    if (actual === null) {
      failures.push({ key, problem: "missing" });
    } else if (actual.replace(/["']/g, "") !== expected) {
      failures.push({ key, problem: `expected "${expected}", found "${actual}"` });
    }
  }

  // trustPolicyExclude: exact pins only. An absent or empty list is the
  // strongest state and valid.
  const excludeStart = lines.findIndex((line) => line.startsWith("trustPolicyExclude:"));
  if (excludeStart !== -1) {
    for (const line of lines.slice(excludeStart + 1)) {
      const item = /^\s+-\s*(.+)$/.exec(line)?.[1];
      if (!item) break; // list ended
      const pin = item.replace(/["']/g, "").trim();
      if (!EXACT_PIN.test(pin)) {
        failures.push({
          key: "trustPolicyExclude",
          problem: `"${pin}" is not an exact name@version pin`,
        });
      }
    }
  }

  return failures;
}

if (process.argv[1]?.endsWith("check-pnpm-policy.ts")) {
  const ROOT = new URL("..", import.meta.url).pathname;
  const failures = evaluatePolicy(readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8"));

  for (const { key, problem } of failures) {
    console.error(`✗ pnpm-workspace.yaml: ${key} ${problem}`);
  }
  if (failures.length > 0) {
    console.error(
      "\nThe install-hardening policy is load-bearing (see the comment block in pnpm-workspace.yaml). " +
        "Restore the guarded keys, or use exact name@version excludes.",
    );
    process.exit(1);
  }
  console.log("✓ pnpm policy intact (minimumReleaseAge, trustPolicy, exact excludes)");
}
