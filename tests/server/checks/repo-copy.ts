import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

export function withRepoCopy<T>(use: (root: string) => T): T {
  const root = mkdtempSync(path.join(tmpdir(), "repo-copy-"));
  try {
    const packages = readdirSync(path.join(repoRoot, "packages")).map((name) => `packages/${name}`);
    const copied = [
      "scripts",
      "tsconfig.json",
      "tsconfig.base.json",
      "tests/kit-consumers",
      "tests/e2e",
      "tests/test-clock.ts",
      "playwright.config.ts",
      "apps/web/tsconfig.json",
      "apps/web/src",
      ...packages.flatMap((dir) => [`${dir}/package.json`, `${dir}/src`]),
    ];
    for (const entry of copied) {
      const from = path.join(repoRoot, entry);
      if (existsSync(from)) cpSync(from, path.join(root, entry), { recursive: true });
    }
    for (const dir of [".", "apps/web", ...packages]) {
      const modules = path.join(repoRoot, dir, "node_modules");
      if (!existsSync(modules)) continue;
      mkdirSync(path.join(root, dir), { recursive: true });
      symlinkSync(modules, path.join(root, dir, "node_modules"));
    }
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
