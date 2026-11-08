#!/usr/bin/env node
// Changeset completeness gate.
//
// Groot ships a published kit (packages, apps/web/drizzle, .groot) to child
// repositories. A branch that edits a managed surface without recording a
// changeset produces unversioned drift for every consumer, and the only
// remedy is a later backfill commit. This gate makes that a build failure
// instead of a convention.
//
// Rules:
//   1. A branch that changes files under packages/[pkg]/src, apps/web/drizzle,
//      or .groot needs a changeset naming each affected package, or a
//      reviewed no-release reason file under .no-release/. Only changesets
//      and reasons the branch itself adds count; an edit or rename does not.
//   2. apps/web/drizzle and .groot belong to the root package, named by the
//      root package.json, so a changeset naming it covers them.
//   3. Every package a changeset the branch adds or edits names must exist in the
//      workspace, because one unknown name fails changeset status and the
//      Release workflow.
//   4. The release bot's own commits are exempt, because versioning PRs are
//      the output of this gate, not its input.
//
// A no-release reason file records why a change ships without a version bump
// (docs-only, internal refactor, test-only). It covers the whole branch, not
// one package: the review that accepted the reason is the record.
//
// Usage: pnpm check:changesets [--base <ref>] [--root <dir>]
// The base defaults to the merge-base with origin/main.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { load as loadYaml } from "js-yaml";
import { mergeBase } from "./lib/merge-base.mjs";

const RELEASE_BOTS = ["github-actions[bot]", "renovate[bot]"];
const BOT_EMAIL_SUFFIX = "@users.noreply.github.com";

// Path prefixes whose changes must be covered by a changeset. A kit
// package's package.json carries its exports map, entrypoints, and published
// file list, which is the surface a child repo consumes first, so a
// manifest edit needs coverage even when no source file changed.
const MANAGED_PREFIXES = [
  "packages/*/src",
  "packages/*/vendor",
  "packages/*/package.json",
  "apps/web/drizzle",
  ".groot",
];

export function matchesManagedPrefix(file) {
  return MANAGED_PREFIXES.some((prefix) => {
    const pattern = "^" + prefix.split("*").map(escapeRegex).join("[^/]+") + "(/|$)";
    return new RegExp(pattern).test(file);
  });
}

// True when the package.json changed between two blobs in a way a consumer
// can observe: a different value under any top-level key except name,
// version, and private. Version is excepted because the release bot owns it
// and its commits are already exempt by author, so a bot bump never reaches
// this test. Every other key counts — exports, main, types, files,
// dependencies, peerDependencies, or a field invented later — so a new
// publishing-relevant key cannot slip through an allowlist. An allowlist
// would also invert the gate's meaning: unlisted would mean safe.
export function pkgJsonChangeIsReleaseRelevant(beforeJson, afterJson) {
  let before;
  let after;
  try {
    before = JSON.parse(beforeJson);
    after = JSON.parse(afterJson);
  } catch {
    // An unparseable manifest is a broken publish surface; surface it here
    // rather than at release time.
    return true;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "name" || key === "version" || key === "private") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return true;
  }
  return false;
}

// True for packages/[pkg]/package.json, the kit's published manifest.
function isKitPackageJson(file) {
  return /^packages\/[^/]+\/package\.json$/.test(file);
}

// The package.json content at HEAD, used when an entry carries no blobs.
function readPkgJsonAt(rootDir, file) {
  const absolute = path.join(rootDir, file);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

// Map a packages/[pkg]/src (or vendor) path to its npm package name from package.json.
// Files under apps/web/drizzle or .groot map to the root package.
function packageNameFor(file, rootDir) {
  if (file.startsWith("apps/web/drizzle") || file.startsWith(".groot/")) {
    return readPackageName(rootDir);
  }
  const scopeDir = file.split("/")[1];
  if (!scopeDir) return null;
  return readPackageName(path.join(rootDir, "packages", scopeDir));
}

function readPackageName(dir) {
  const pkgJson = path.join(dir, "package.json");
  if (!existsSync(pkgJson)) return null;
  return JSON.parse(readFileSync(pkgJson, "utf8")).name ?? null;
}

// Every workspace package name, the root first: the root package.json plus
// each package.json that a pnpm-workspace.yaml `packages:` entry covers.
export function readWorkspacePackages(rootDir) {
  const workspaceFile = path.join(rootDir, "pnpm-workspace.yaml");
  const globs = existsSync(workspaceFile)
    ? (loadYaml(readFileSync(workspaceFile, "utf8"))?.packages ?? [])
    : [];
  const dirs = globs.flatMap((glob) => {
    const literal = glob.endsWith("/*") ? glob.slice(0, -2) : glob;
    if (literal.includes("*") || glob.startsWith("!")) {
      throw new Error(`changesets: unsupported pnpm-workspace.yaml glob "${glob}"`);
    }
    if (literal === glob) return [path.join(rootDir, glob)];
    const parent = path.join(rootDir, literal);
    if (!existsSync(parent)) return [];
    return readdirSync(parent, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(parent, d.name));
  });
  const rootName = readPackageName(rootDir);
  const others = dirs.map(readPackageName).filter((name) => name && name !== rootName);
  return [...(rootName ? [rootName] : []), ...new Set(others.sort())];
}

// Every [name, type] pair in a changeset's frontmatter. The delimiter regex is
// @changesets/parse's own, and the frontmatter is read as YAML, so CRLF, blank
// lines, comments and spacing parse the way the Release workflow parses them.
export function parseChangesetFrontmatter(body) {
  const match = /\s*---([^]*?)\r?\n\s*---(\s*(?:\n|$)[^]*)/.exec(body);
  if (!match) return [];
  let data;
  try {
    data = loadYaml(match[1]);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data);
}

// Package names a changeset releases with a version bump, so `none` and prose
// that merely looks like YAML (the changesets README) do not count as coverage.
export function parseChangesetReleases(body) {
  return parseChangesetFrontmatter(body)
    .filter(([, type]) => ["major", "minor", "patch"].includes(type))
    .map(([name]) => name);
}

// True when a commit author is the release bot.
export function isReleaseBotCommit(commit) {
  const { name, email } = commit;
  if (RELEASE_BOTS.includes(name)) return true;
  return (
    (name === "github-actions" || name === "renovate") &&
    typeof email === "string" &&
    email.endsWith(BOT_EMAIL_SUFFIX)
  );
}

// The checkable state of one branch, pure over its inputs so the unit test
// can drive fixture diffs without spawning git for the package mapping.
// changedEntries pairs each changed path with its package.json pre-image
// and post-image so manifest edits are filtered by field; changedFiles
// alone treats every packages/[pkg]/package.json edit as release-relevant.
export function collect(state) {
  const rootDir = state.rootDir ?? process.cwd();
  const entries = state.changedEntries ?? state.changedFiles.map((f) => ({ file: f }));
  const changedManagedFiles = [];
  const managedPackages = new Set();
  for (const entry of entries) {
    if (!matchesManagedPrefix(entry.file)) continue;
    if (
      isKitPackageJson(entry.file) &&
      !pkgJsonChangeIsReleaseRelevant(
        entry.pkgJsonBefore ?? "",
        entry.pkgJsonAfter ?? readPkgJsonAt(rootDir, entry.file),
      )
    ) {
      continue;
    }
    changedManagedFiles.push(entry.file);
    const name = packageNameFor(entry.file, rootDir);
    if (name) managedPackages.add(name);
  }
  const coveredPackages = new Set();
  const unknownReleases = [];
  for (const entry of state.changesetFiles) {
    if (entry.added) {
      for (const name of parseChangesetReleases(entry.body)) coveredPackages.add(name);
    }
    for (const [name] of parseChangesetFrontmatter(entry.body)) {
      if (!state.workspacePackages.includes(name)) {
        unknownReleases.push(`.changeset/${entry.name} names unknown package "${name}"`);
      }
    }
  }
  return {
    managedPackages: [...managedPackages].sort(),
    coveredPackages: [...coveredPackages].sort(),
    reason: state.noReleaseReason ?? null,
    changedManagedFiles: changedManagedFiles.sort(),
    unknownReleases,
    workspacePackages: state.workspacePackages,
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function git(args, root) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function markdownIn(root, files, dir) {
  return files
    .filter(
      (f) => path.posix.dirname(f) === dir && f.endsWith(".md") && existsSync(path.join(root, f)),
    )
    .sort()
    .map((f) => ({ name: path.basename(f), body: readFileSync(path.join(root, f), "utf8") }));
}

// Changesets the branch adds or edits. Only an added one counts as coverage,
// but an edit that names an unknown package still breaks the Release workflow.
function listChangesetFiles(root, changedFiles, addedFiles) {
  const added = new Set(addedFiles);
  return markdownIn(root, changedFiles, ".changeset")
    .filter((f) => f.name !== "README.md")
    .map((f) => ({ ...f, added: added.has(`.changeset/${f.name}`) }));
}

function findNoReleaseReason(root, addedFiles) {
  // Lives outside .changeset/: @changesets/read's legacy v1 reader treats any
  // directory there as an old-format changeset (needs changes.md + changes.json)
  // and fails the Release workflow with ENOENT.
  const reason = markdownIn(root, addedFiles, ".no-release").find((f) => f.body.trim());
  if (!reason) return null;
  return `${reason.name}: ${reason.body.trim().split("\n")[0]}`;
}

// True when every commit in base..HEAD that touches a managed file is the
// release bot's own. One human commit touching the surface voids the skip.
function botOnlySurfaces(root, base, managedFiles) {
  const managed = new Set(managedFiles);
  const commits = git(["rev-list", `${base}..HEAD`], root)
    .split("\n")
    .filter(Boolean);
  return commits.every((sha) => {
    const touched = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], root)
      .split("\n")
      .filter(Boolean);
    if (!touched.some((f) => managed.has(f))) return true;
    const [name, email] = git(["show", "-s", "--format=%an%n%ae", sha], root).split("\n");
    return isReleaseBotCommit({ name, email });
  });
}

// The verdict for one branch state, pure over collect()'s output. The
// release-bot exemption is layered on by run(), because it needs git.
export function evaluate(state) {
  if (state.unknownReleases.length > 0) {
    const packages = state.workspacePackages.join(", ");
    return {
      status: 1,
      unknown: state.unknownReleases,
      err:
        state.unknownReleases
          .map((line) => `changesets: ${line}; packages are: ${packages}\n`)
          .join("") +
        `  use "${state.workspacePackages[0]}" for apps/web/drizzle and .groot changes\n`,
    };
  }
  if (state.managedPackages.length === 0) {
    return {
      status: 0,
      out:
        "changesets: no managed package surface changed; nothing to cover\n" +
        `  managed: packages/*/src and packages/*/package.json (that package), apps/web/drizzle and .groot ("${state.workspacePackages[0] ?? "the root package"}")\n`,
    };
  }
  if (state.reason) {
    return {
      status: 0,
      out:
        `changesets: no-release reason accepted (${state.reason})\n` +
        `  changed managed surface: ${state.managedPackages.join(", ")}\n`,
    };
  }
  const missing = state.managedPackages.filter((p) => !state.coveredPackages.includes(p));
  if (missing.length === 0) {
    return {
      status: 0,
      out: `changesets: ${state.managedPackages.join(", ")} covered\n`,
    };
  }
  return {
    status: 1,
    missing,
    err:
      `changesets: missing changeset for ${missing.join(", ")}\n` +
      `  changed managed files:\n` +
      state.changedManagedFiles.map((f) => `    ${f}\n`).join("") +
      `  run pnpm changeset, or record the reviewed reason under .no-release/ for a docs-only or internal change\n`,
  };
}

// The file content at one revision, or "" when it does not exist there.
// Reading the real blobs from git is exact where reconstructing them from a
// diff is not: a diff carries only the lines around each hunk, so a partial
// reconstruction of a JSON manifest cannot be parsed.
function showBlob(root, revision, file) {
  try {
    return git(["show", `${revision}:${file}`], root);
  } catch {
    return "";
  }
}

export function run({ base, root }) {
  const repoRoot = root ?? process.cwd();
  const diffBase = mergeBase(base ?? "origin/main", repoRoot);
  const diffNames = (...args) =>
    git(["diff", "--name-only", ...args, `${diffBase}...HEAD`], repoRoot)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const changedFiles = diffNames();
  // Rename detection keeps a renamed reason or changeset out of the added set.
  const addedFiles = diffNames("--diff-filter=A", "--find-renames");
  const changedEntries = changedFiles.map((file) => {
    if (!isKitPackageJson(file)) return { file };
    return {
      file,
      pkgJsonBefore: showBlob(repoRoot, diffBase, file),
      pkgJsonAfter: showBlob(repoRoot, "HEAD", file),
    };
  });
  const state = collect({
    rootDir: repoRoot,
    changedFiles,
    changedEntries,
    changesetFiles: listChangesetFiles(repoRoot, changedFiles, addedFiles),
    noReleaseReason: findNoReleaseReason(repoRoot, addedFiles),
    workspacePackages: readWorkspacePackages(repoRoot),
  });
  const verdict = evaluate(state);
  if (verdict.missing && botOnlySurfaces(repoRoot, diffBase, state.changedManagedFiles)) {
    return {
      status: 0,
      out:
        `changesets: skipping release-bot commits (exempt authors: ${RELEASE_BOTS.join(", ")})\n` +
        `  changed managed surface: ${state.managedPackages.join(", ")}\n`,
      state,
      base: diffBase,
    };
  }
  return { ...verdict, state, base: diffBase };
}

function flagValue(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}

function invokedAsCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (invokedAsCli()) {
  const result = run({
    base: flagValue(process.argv.slice(2), "--base"),
    root: flagValue(process.argv.slice(2), "--root"),
  });
  if (result.out) process.stdout.write(result.out);
  if (result.err) process.stderr.write(result.err);
  process.exitCode = result.status;
}
