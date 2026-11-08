import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { enforcedRuleIds } from "../../../scripts/lint/boundaries";
import { ruleTableProblems } from "../../../scripts/check-rule-table";

const agents = readFileSync("AGENTS.md", "utf8");
const R7_ROW = /^\| No transactions in `packages\/`.*\n/m;

describe("AGENTS.md rule table", () => {
  it("names exactly the lint rule ids boundaries.ts enforces", () => {
    expect(ruleTableProblems(agents, enforcedRuleIds)).toEqual([]);
  });

  it("fails a row naming an id no lint rule has, naming the row", () => {
    const fake = agents.replace(R7_ROW, (row) => `${row}| Never ship on Fridays. | R99 |\n`);
    const [problem, ...rest] = ruleTableProblems(fake, enforcedRuleIds);
    expect(rest).toEqual([]);
    expect(problem).toMatch(/^AGENTS\.md:\d+ row "Never ship on Fridays\." names R99, /);
  });

  it("fails a lint rule that no row names", () => {
    expect(R7_ROW.test(agents)).toBe(true);
    expect(ruleTableProblems(agents.replace(R7_ROW, ""), enforcedRuleIds)).toEqual([
      "scripts/lint/boundaries.ts enforces R7, which no row of the AGENTS.md rule table names. Add R7 to the row of the rule it enforces, or delete the lint rule.",
    ]);
  });
});
