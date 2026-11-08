import { describe, expect, it } from "vite-plus/test";
import { evaluatePolicy } from "../../../scripts/check-pnpm-policy";

/**
 * Supply-chain policy guard (scripts/check-pnpm-policy.ts).
 *
 * The guard pins the two halves of pnpm-workspace.yaml's hardening: the
 * trustPolicy/minimumReleaseAge values and exact name@version excludes. The
 * pure verdict runs here against synthetic workspace files — the intact
 * policy, each weakening of it, and the edge shapes a bulk edit could
 * produce.
 */

const INTACT = [
  "minimumReleaseAge: 1440",
  "trustPolicy: no-downgrade",
  "packages:",
  '  - "."',
  "trustPolicyExclude:",
  "  - semver@6.3.1",
].join("\n");

describe("pnpm policy guard", () => {
  it("passes the intact policy", () => {
    expect(evaluatePolicy(INTACT)).toEqual([]);
  });

  it("passes an empty exclude list", () => {
    expect(evaluatePolicy(`${INTACT}\ntrustPolicyExclude: []\n`)).toEqual([]);
  });

  it("rejects a weakened trustPolicy value", () => {
    const out = evaluatePolicy(INTACT.replace("trustPolicy: no-downgrade", "trustPolicy: ignore"));
    expect(out).toEqual([
      { key: "trustPolicy", problem: 'expected "no-downgrade", found "ignore"' },
    ]);
  });

  it("rejects a missing release-age gate", () => {
    const out = evaluatePolicy(INTACT.replace("minimumReleaseAge: 1440\n", ""));
    expect(out).toEqual([{ key: "minimumReleaseAge", problem: "missing" }]);
  });

  it("rejects wildcard excludes: bare name, @*, and range", () => {
    for (const exclude of ["- semver", '- "semver@*"', "- semver@^6"]) {
      const out = evaluatePolicy(INTACT.replace("- semver@6.3.1", exclude));
      expect(out).toHaveLength(1);
      expect(out[0].key).toBe("trustPolicyExclude");
    }
  });

  it("accepts a different exact pin", () => {
    expect(evaluatePolicy(INTACT.replace("- semver@6.3.1", "- semver@6.3.2"))).toEqual([]);
  });

  it("ignores the policy description in comments", () => {
    const commented = `# trustPolicy: no-downdown: docs mention values all the time\n${INTACT}`;
    expect(evaluatePolicy(commented)).toEqual([]);
  });
});
