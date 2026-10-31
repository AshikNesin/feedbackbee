#!/usr/bin/env tsx
/**
 * Seed the local database with the dev demo user (the login page offers its
 * credentials in development). Idempotent. On a deployment there is no seed:
 * the first sign-in creates the owner (apps/web/src/server/api/auth/first-owner.ts).
 *
 * App-owned (a groot skip pattern): groot's seed also creates todos.
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db, users } from "@groot/core/database";
import { hashPassword } from "@groot/core/utils/password.utils";
import { startWebApp } from "../apps/web/src/server/app";
import { openDatabase } from "../apps/web/src/server/db/node";

export const SEED_USER = {
  email: "demo@example.com",
  password: "demo@example.com", // gitleaks:allow (documented dev-only demo account)
  name: "Demo User",
};

/** Boot against `DATABASE_URL` (migrations applied) and make sure the demo user exists. */
export async function seed(): Promise<void> {
  startWebApp({
    env: { LOG_LEVEL: "warn", ...process.env },
    db: (env) => openDatabase(env.DATABASE_URL),
  });

  const [existing] = await db.select().from(users).where(eq(users.email, SEED_USER.email)).limit(1);
  if (existing) {
    console.log("   Seed user already exists");
  } else {
    await db.insert(users).values({
      email: SEED_USER.email,
      name: SEED_USER.name,
      password: await hashPassword(SEED_USER.password),
    });
    console.log("   ✅ Seed user created");
  }
  console.log(`   📧 Email:    ${SEED_USER.email}`);
  console.log(`   🔑 Password: ${SEED_USER.password}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
