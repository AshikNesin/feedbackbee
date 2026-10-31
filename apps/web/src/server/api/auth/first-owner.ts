import { sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { loginSchema } from "@groot/core/auth/auth.schema";
import { hashPassword } from "@groot/core/utils/password.utils";
import type { AppEnv } from "@groot/core/types";
import { db, users } from "../../db";

/**
 * Zero-setup owner account: while the deployment has no users, the first
 * sign-in creates one with the credentials it was given, then core's login
 * handler signs it in. After that this is one indexed read per login.
 *
 * Runs in front of `POST /api/v1/auth/login`. The insert is conditional, so two
 * racing first sign-ins still leave exactly one owner.
 */
export const firstOwner = createMiddleware<AppEnv>(async (c, next) => {
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!anyUser) {
    const credentials = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (credentials.success) {
      const password = await hashPassword(credentials.data.password);
      const now = Date.now();
      await db.run(sql`
        INSERT INTO users (email, password, created_at, updated_at)
        SELECT ${credentials.data.email}, ${password}, ${now}, ${now}
        WHERE NOT EXISTS (SELECT 1 FROM users)`);
    }
  }
  await next();
});
