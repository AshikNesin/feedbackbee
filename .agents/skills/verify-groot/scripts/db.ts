#!/usr/bin/env -S node_modules/.bin/tsx
// Read-only SQL against a run's database, to prove side effects.
//   node_modules/.bin/tsx .agents/skills/verify-groot/scripts/db.ts <run> "select * from todos" [params...]
// Prints rows as JSON. Goes through the app's own database layer, as
// scripts/seed.ts does (AGENTS.md R8a: no second driver), and accepts only
// SELECT / WITH / read-only PRAGMA statements.
import { sql } from "drizzle-orm";
import { db } from "@groot/core/database";
import { startWebApp } from "../../../../apps/web/src/server/app";
import { openDatabase } from "../../../../apps/web/src/server/db/node";
import { readInstance, requireRun } from "./lib.mjs";

const argv = process.argv.slice(2);
const run = requireRun(argv, 'db.ts <run> "<select ...>" [params...]');
const [, query, ...params] = argv;
const readOnly =
  /^\s*(select|with|pragma\s+table_info)\b/i.test(query ?? "") &&
  !/;\s*\S/.test(query ?? "") &&
  !/\b(insert|update|delete|drop|alter|create|attach|detach|vacuum)\b/i.test(query ?? "");
if (!query || !readOnly) {
  console.error('usage: db.ts <run> "<select ...>" [params...]  (one SELECT/WITH statement)');
  process.exit(2);
}

const { dbFile } = readInstance(run);
startWebApp({
  env: { ...process.env, LOG_LEVEL: "silent", DATABASE_URL: `file:${dbFile}` },
  db: (env) => openDatabase(env.DATABASE_URL),
});

// Bind each `?` to the next param, so values are never spliced into the SQL.
const parts = query.split("?");
if (parts.length - 1 !== params.length) {
  console.error(`query has ${parts.length - 1} placeholder(s) but ${params.length} param(s)`);
  process.exit(2);
}
const statement = sql.join(
  parts.map((part, i) => (i < params.length ? sql`${sql.raw(part)}${params[i]}` : sql.raw(part))),
  sql.raw(""),
);
console.log(JSON.stringify(await db.all(statement), null, 2));
