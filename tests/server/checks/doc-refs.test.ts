import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const SCRIPT = path.resolve("scripts/check-doc-refs.mjs");

const TREE: Record<string, string> = {
  "package.json": JSON.stringify({ scripts: { dev: "node src/app.ts" } }),
  ".gitignore": "dist/\n",
  "src/app.ts": "export {};\n",
  "src/pages/Home.tsx": "export {};\n",
  ".agents/skills/demo/scripts/run.mjs": "\n",
  ".agents/skills/demo/SKILL.md": "Run `scripts/run.mjs`.\n",
  "docs/adr/0001-old.md": "Lived in `src/gone.ts`. See [the guide](../guide.md).\n",
  "docs/guide.md": [
    "Start in [the app](../src/app.ts).",
    "Then read [the missing page](./missing.md).",
    "The build writes `dist/server.js`.",
    "Run `pnpm dev`, then `pnpm nope`.",
    "Pages import `src/pages/Home` and `./pages/Home`.",
    // An absolute path is outside the repo; it must not void the ignore check above.
    "Scratch notes go in `/tmp/notes.md`.",
  ].join("\n"),
  "docs/nested/page.md": [
    "Back to [the guide](/docs/guide.md).",
    'Read [the old page](/docs/gone.md "Gone").',
  ].join("\n"),
};

let root: string;

function runChecker(): { status: number | null; lines: string[] } {
  const result = spawnSync("node", [SCRIPT], { cwd: root, encoding: "utf8" });
  return { status: result.status, lines: result.stdout.trim().split("\n") };
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "doc-refs-"));
  for (const [file, body] of Object.entries(TREE)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("check-doc-refs", () => {
  it("fails on exactly the dead links and the unknown script, naming file and line", () => {
    const { status, lines } = runChecker();
    expect(status).toBe(1);
    expect(lines).toEqual([
      "docs/guide.md:2  missing link docs/missing.md. Fix the path or delete the sentence.",
      "docs/guide.md:4  missing script pnpm nope. Fix the path or delete the sentence.",
      "docs/nested/page.md:2  missing link docs/gone.md. Fix the path or delete the sentence.",
      "3 dangling references in 4 docs",
    ]);
  });

  it("passes once the dead references are fixed", () => {
    writeFileSync(
      path.join(root, "docs/guide.md"),
      "Start in [the app](../src/app.ts).\nRun `pnpm dev`.\n",
    );
    writeFileSync(path.join(root, "docs/nested/page.md"), "Back to [the guide](/docs/guide.md).\n");
    const { status, lines } = runChecker();
    expect(status).toBe(0);
    expect(lines).toEqual(["0 dangling references in 4 docs"]);
  });
});
