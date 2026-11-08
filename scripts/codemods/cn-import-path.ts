#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SHELL_IMPORT =
  /\b(import|export)\s*\{([^}]*)\}\s*from\s*(["'])(@groot\/shell\/lib\/utils(?:\.ts)?)\3;?/g;

function rewriteCnImport(source: string): string {
  return source.replace(
    SHELL_IMPORT,
    (whole, keyword: string, names: string, quote: string, shellPath: string) => {
      const specifiers = names
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const cn = specifiers.filter((s) => /^cn(\s+as\s+\w+)?$/.test(s));
      if (cn.length === 0) return whole;
      const rest = specifiers.filter((s) => !cn.includes(s));
      const uiLine = `${keyword} { ${cn.join(", ")} } from ${quote}@groot/ui/lib/utils${quote};`;
      if (rest.length === 0) return uiLine;
      return `${keyword} { ${rest.join(", ")} } from ${quote}${shellPath}${quote};\n${uiLine}`;
    },
  );
}

const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : execFileSync(
        "git",
        ["ls-files", "--", "apps/*.ts", "apps/*.tsx", "packages/*.ts", "packages/*.tsx"],
        { encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean);

let changed = 0;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  const after = rewriteCnImport(before);
  if (after === before) continue;
  writeFileSync(file, after);
  changed++;
  console.log(file);
}
console.log(`cn-import-path: rewrote ${changed} file(s)`);
