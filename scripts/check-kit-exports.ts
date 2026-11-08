#!/usr/bin/env tsx
/**
 * Kit export guard.
 *
 * Each package in PACKAGES declares every public entrypoint explicitly. A
 * wildcard export ("./*") accepts any file that lands in src, so the public
 * surface would drift silently. This guard keeps three sets in agreement:
 * the explicit keys in each package's exports map, the source files under
 * src, and the subpaths the compiled consumer fixture
 * (tests/kit-consumers/consumer.tsx) imports.
 *
 * - A source file no entry targets is a module outside the public map, or an
 *   entry someone forgot to add. Both are drift.
 * - An entry whose target file does not exist is a broken subpath.
 * - A subpath the fixture never imports is unexercised. The fixture is the
 *   gate for the removal policy in AGENTS.md, so an unexercised subpath
 *   fails rather than shipping untested surface.
 * - A named export of a public subpath on the merge base that is gone now is
 *   a removal, which AGENTS.md allows only in a major, after a deprecation.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
// TypeScript 7 (the native compiler) ships no classic JS API; the TS 6 package
// keeps it for AST scripts like this one.
import ts from "@typescript/typescript6";
import { mergeBase } from "./lib/merge-base.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSION = /\.(ts|tsx)$/;
const REMOVALS_FILE = "scripts/kit-export-removals.json";
const { values: args } = parseArgs({
  options: { base: { type: "string", default: "origin/main" } },
});

interface PackageRule {
  name: string;
  manifest: string;
  /** Entry key for a fixture import specifier, or null when out of scope. */
  keyForSpecifier: (specifier: string) => string | null;
}

const PACKAGES: PackageRule[] = [
  {
    name: "@groot/ui",
    manifest: "packages/ui/package.json",
    keyForSpecifier: (specifier) =>
      specifier === "@groot/ui"
        ? "."
        : specifier.startsWith("@groot/ui/")
          ? `.${specifier.slice("@groot/ui".length)}`
          : null,
  },
  {
    name: "@groot/jobs",
    manifest: "packages/jobs/package.json",
    keyForSpecifier: (specifier) =>
      specifier.startsWith("@groot/jobs/") ? `.${specifier.slice("@groot/jobs".length)}` : null,
  },
];

function stripExtension(file: string): string {
  return file.replace(/\.tsx?$/, "");
}

function listSourceFiles(srcDir: string): Set<string> {
  const files = new Set<string>();
  const queue = [srcDir];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) queue.push(relative);
      else if (SOURCE_EXTENSION.test(entry.name)) files.add(stripExtension(relative));
    }
  }
  return files;
}

function readManifest(rule: PackageRule): { targets: Map<string, string>; wildcards: string[] } {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, rule.manifest), "utf8"));
  const targets = new Map<string, string>();
  const wildcards: string[] = [];
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    if (key.includes("*")) {
      wildcards.push(key);
      continue;
    }
    const target = path.normalize(path.join(path.dirname(rule.manifest), String(value)));
    targets.set(key, stripExtension(target.split(path.sep).join("/")));
  }
  return { targets, wildcards };
}

function fixtureImports(): Set<string> {
  const source = fs.readFileSync(path.join(repoRoot, "tests/kit-consumers/consumer.tsx"), "utf8");
  const imports = new Set<string>();
  for (const match of source.matchAll(/from "(@groot\/[a-z]+(?:\/[^"]*)?)"/g))
    imports.add(match[1]);
  if (imports.size === 0) {
    throw new Error("tests/kit-consumers/consumer.tsx matched no @groot/* imports");
  }
  return imports;
}

let failed = false;
const exercised = fixtureImports();

for (const rule of PACKAGES) {
  const { targets, wildcards } = readManifest(rule);
  for (const key of wildcards) {
    console.error(`${rule.manifest}: wildcard export "${key}" — list entrypoints explicitly`);
    failed = true;
  }

  const srcDir = path.join(path.dirname(rule.manifest), "src");
  const sources = listSourceFiles(srcDir);
  const targeted = new Set(targets.values());

  const unowned = [...sources].filter((source) => !targeted.has(source)).sort();
  for (const file of unowned) {
    console.error(
      `${rule.name}: source ${path.relative(repoRoot, file)} is targeted by no exports entry`,
    );
    failed = true;
  }
  for (const [key, target] of [...targets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!sources.has(target)) {
      console.error(
        `${rule.name}: exports entry "${key}" targets missing file ${path.relative(repoRoot, target)}`,
      );
      failed = true;
    }
  }

  const exercisedKeys = new Set<string>();
  for (const specifier of exercised) {
    const key = rule.keyForSpecifier(specifier);
    if (key === null) continue;
    exercisedKeys.add(key);
    if (!targets.has(key)) {
      console.error(
        `${rule.name}: fixture imports "${specifier}" but the exports map has no such entry`,
      );
      failed = true;
    }
  }
  for (const key of [...targets.keys()].filter((k) => !exercisedKeys.has(k)).sort()) {
    console.error(`${rule.name}: subpath "${key}" is public but the kit fixture never imports it`);
    failed = true;
  }

  console.log(
    `${rule.name}: ${targets.size} entrypoints, ${exercisedKeys.size} exercised by the fixture`,
  );
}

type Reader = (file: string) => string | null;

const readHead: Reader = (file) => {
  const absolute = path.join(repoRoot, file);
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile()
    ? fs.readFileSync(absolute, "utf8")
    : null;
};

function git(...gitArgs: string[]): string {
  return execFileSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function readerAt(revision: string): Reader {
  return (file) => {
    try {
      return git("cat-file", "-t", `${revision}:${file}`).trim() === "blob"
        ? git("show", `${revision}:${file}`)
        : null;
    } catch {
      return null;
    }
  };
}

function resolveModule(read: Reader, file: string): string | null {
  const stem = file.replace(/\.[cm]?[jt]sx?$/, "");
  const candidates = [file, `${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, `${stem}/index.tsx`];
  return candidates.find((candidate) => read(candidate) !== null) ?? null;
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);

function exportedNames(read: Reader, file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  const resolved = resolveModule(read, file);
  if (!resolved || seen.has(resolved)) return names;
  seen.add(resolved);
  const source = ts.createSourceFile(resolved, read(resolved)!, ts.ScriptTarget.Latest);
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      const from = statement.moduleSpecifier as ts.StringLiteral | undefined;
      if (clause && ts.isNamedExports(clause)) {
        for (const element of clause.elements) names.add(element.name.text);
      } else if (clause) {
        names.add(clause.name.text);
      } else if (from?.text.startsWith(".")) {
        const target = path.posix.join(path.posix.dirname(resolved), from.text);
        for (const name of exportedNames(read, target, seen)) names.add(name);
      } else if (from) {
        names.add(`* from "${from.text}"`);
      }
    } else if (ts.isExportAssignment(statement)) {
      names.add("default");
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        names.add("default");
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
        }
      } else {
        const name = (statement as ts.DeclarationStatement).name;
        if (name && ts.isIdentifier(name)) names.add(name.text);
      }
    }
  }
  return names;
}

function entryTargets(read: Reader, manifest: string): Map<string, string> {
  const text = read(manifest);
  const exports: Record<string, string> = text ? (JSON.parse(text).exports ?? {}) : {};
  return new Map(
    Object.entries(exports)
      .filter(([key]) => !key.includes("*"))
      .map(([key, target]) => [key, path.posix.join(path.posix.dirname(manifest), target)]),
  );
}

/**
 * One approved removal: export `name` of `subpath` (such as
 * "@groot/ui/breadcrumb"). `until` is the package version ("2.0.0") or the
 * date ("2027-01-31") from which the entry fails, so it is deleted once the
 * removal has shipped.
 */
type ApprovedRemoval = { subpath: string; name: string; reason: string; until?: string };

const VERSION = /^\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const versionParts = (version: string) => version.split(/[.+-]/).slice(0, 3).map(Number);

function versionReached(current: string, until: string): boolean {
  const [now, end] = [versionParts(current), versionParts(until)];
  const differs = now.findIndex((part, i) => part !== end[i]);
  return differs === -1 || now[differs] > end[differs];
}

function readApprovedRemovals(): ApprovedRemoval[] {
  const approved: ApprovedRemoval[] = JSON.parse(readHead(REMOVALS_FILE) ?? "[]");
  const today = new Date().toISOString().slice(0, 10);
  const fail = (message: string) => {
    console.error(message);
    failed = true;
  };
  for (const entry of approved) {
    const label = `${REMOVALS_FILE}: entry "${entry.name}" of ${entry.subpath}`;
    const rule = PACKAGES.find(
      (p) => entry.subpath === p.name || entry.subpath?.startsWith(`${p.name}/`),
    );
    if (!rule) {
      fail(
        `${label} names no kit subpath. Key it by the public subpath that lost the export, such as "@groot/ui/breadcrumb".`,
      );
      continue;
    }
    const { until } = entry;
    if (until === undefined) continue;
    const version: string = JSON.parse(readHead(rule.manifest)!).version;
    let reached: string | null = null;
    if (VERSION.test(until)) {
      if (versionReached(version, until)) reached = `${rule.name} is at ${version}`;
    } else if (DATE.test(until)) {
      if (today >= until) reached = `today is ${today}`;
    } else {
      fail(`${label} has "until": "${until}". Use a version (2.0.0) or a date (2027-01-31).`);
      continue;
    }
    if (reached) {
      fail(
        `${label} expired at ${until} (${reached}). The removal it approved has shipped: delete the entry from ${REMOVALS_FILE}.`,
      );
    }
  }
  return approved;
}

function checkRemovedExports(base: string, approved: ApprovedRemoval[]): void {
  const readBase = readerAt(base);
  for (const rule of PACKAGES) {
    const headTargets = entryTargets(readHead, rule.manifest);
    for (const [key, baseTarget] of entryTargets(readBase, rule.manifest)) {
      const headTarget = headTargets.get(key);
      const now = headTarget ? exportedNames(readHead, headTarget) : new Set<string>();
      const subpath = `${rule.name}${key.slice(1)}`;
      for (const name of exportedNames(readBase, baseTarget)) {
        if (now.has(name)) continue;
        if (approved.some((a) => a.subpath === subpath && a.name === name)) continue;
        console.error(
          `${subpath}: export "${name}" is on ${base.slice(0, 7)} but gone now. Removing a kit export is a compatibility break (AGENTS.md): deprecate it in a minor release and remove it in the next major. For an approved removal add {"subpath": "${subpath}", "name": "${name}", "reason": "...", "until": "<the next major version>"} to ${REMOVALS_FILE}.`,
        );
        failed = true;
      }
    }
  }
}

let insideGit = false;
try {
  insideGit = git("rev-parse", "--is-inside-work-tree").trim() === "true";
} catch {
  console.log("kit exports: not a git checkout, so removed exports are not checked");
}
const approved = readApprovedRemovals();
if (insideGit) checkRemovedExports(mergeBase(args.base!, repoRoot), approved);

if (failed) process.exit(1);
console.log("kit exports and consumer fixture agree");
