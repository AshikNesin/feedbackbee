#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
// TypeScript 7 (the native compiler) ships no classic JS API; the TS 6 package
// keeps it for AST scripts like this one.
import ts from "@typescript/typescript6";

type Finding = { file: string; line: number; name: string };

const MAX_ROUNDS = 10;

function run(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const removeFiles = process.argv.includes("--remove-files");

function knipFix() {
  const result = run("pnpm", [
    "exec",
    "knip",
    "--no-progress",
    "--no-exit-code",
    "--fix",
    "--fix-type",
    removeFiles ? "exports,types,duplicates,files" : "exports,types,duplicates",
    ...(removeFiles ? ["--allow-remove-files"] : []),
  ]);
  if (result.status !== 0) throw new Error(`knip --fix failed:\n${result.stderr}`);
}

function unusedBindings(): Finding[] {
  const result = run("pnpm", ["exec", "vp", "lint", "-f", "json"]);
  const { diagnostics } = JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))) as {
    diagnostics: {
      code: string;
      filename: string;
      labels: { label: string; span: { line: number } }[];
    }[];
  };
  return diagnostics
    .filter((d) => d.code === "eslint(no-unused-vars)")
    .map((d) => ({
      file: d.filename,
      line: d.labels[0].span.line,
      name: /'([^']+)'/.exec(d.labels[0].label)![1],
    }));
}

function findIdentifier(source: ts.SourceFile, finding: Finding): ts.Identifier {
  let match: ts.Identifier | undefined;
  const visit = (node: ts.Node) => {
    if (match) return;
    if (
      ts.isIdentifier(node) &&
      node.text === finding.name &&
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 === finding.line
    ) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!match) throw new Error(`${finding.file}:${finding.line} has no identifier ${finding.name}`);
  return match;
}

function isTopLevelDeclaration(node: ts.Node): node is ts.Statement {
  return (
    ts.isSourceFile(node.parent) &&
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1))
  );
}

function rangeWithLeadingComments(source: ts.SourceFile, statement: ts.Node): [number, number] {
  const text = source.text;
  let start = statement.getStart(source);
  const comments = ts.getLeadingCommentRanges(text, statement.getFullStart()) ?? [];
  for (const comment of comments.toReversed()) {
    if (/\n[ \t]*\n/.test(text.slice(comment.end, start))) break;
    start = comment.pos;
  }
  while (start > 0 && text[start - 1] !== "\n") start--;
  let end = statement.getEnd();
  while (end < text.length && text[end] !== "\n") end++;
  return [start, end + 1];
}

type Edit = [start: number, end: number, text: string];

function pruneImport(
  source: ts.SourceFile,
  declaration: ts.ImportDeclaration,
  unused: Set<ts.Node>,
): Edit {
  const clause = declaration.importClause!;
  const named = clause.namedBindings;
  const parts: ts.Node[] = [
    ...(clause.name ? [clause.name] : []),
    ...(named && ts.isNamedImports(named) ? named.elements : named ? [named] : []),
  ];
  if (parts.every((part) => unused.has(part))) {
    return [...rangeWithLeadingComments(source, declaration), ""];
  }
  if (!named || !ts.isNamedImports(named) || (clause.name && unused.has(clause.name))) {
    throw new Error(`${source.fileName}: mixed default and named import; fix by hand`);
  }
  const kept = named.elements.filter((element) => !unused.has(element));
  const text = `{ ${kept.map((element) => element.getText(source)).join(", ")} }`;
  return [named.getStart(source), named.getEnd(), text];
}

function removeFindings(file: string, findings: Finding[]) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits: Edit[] = [];
  const unusedImports = new Map<ts.ImportDeclaration, Set<ts.Node>>();
  for (const finding of findings) {
    const identifier = findIdentifier(source, finding);
    let node: ts.Node = identifier.parent;
    if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node)) {
      const part = ts.isImportClause(node) ? identifier : node;
      const declaration = ts.findAncestor(node, ts.isImportDeclaration)!;
      unusedImports.set(declaration, (unusedImports.get(declaration) ?? new Set()).add(part));
      continue;
    }
    if (ts.isVariableDeclaration(node)) node = node.parent.parent;
    if (!isTopLevelDeclaration(node)) {
      throw new Error(
        `${file}:${finding.line} ${finding.name} is not a top-level declaration; fix by hand`,
      );
    }
    edits.push([...rangeWithLeadingComments(source, node), ""]);
  }
  for (const [declaration, unused] of unusedImports) {
    edits.push(pruneImport(source, declaration, unused));
  }
  let text = source.text;
  for (const [start, end, replacement] of edits.toSorted((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + replacement + text.slice(end);
  }
  writeFileSync(file, text);
}

function removeAll(findings: Finding[]) {
  const byFile = Map.groupBy(findings, (f) => f.file);
  for (const [file, fileFindings] of byFile) removeFindings(file, fileFindings);
  return byFile.size;
}

for (let round = 1; ; round++) {
  if (round > MAX_ROUNDS) throw new Error(`still finding dead code after ${MAX_ROUNDS} rounds`);
  knipFix();
  const findings = unusedBindings();
  if (findings.length === 0) break;
  const files = removeAll(findings);
  console.log(`round ${round}: removed ${findings.length} unused bindings in ${files} files`);
}
run("pnpm", ["exec", "vp", "fmt"]);
const check = spawnSync("pnpm", ["exec", "knip", "--no-progress"], { stdio: "inherit" });
if (check.status !== 0 && !removeFiles) {
  console.error(
    "Unused files are kept unless you pass --remove-files. Add a file loaded by URL, dynamic import or a script to `entry` in knip.json first.",
  );
}
process.exit(check.status ?? 1);
