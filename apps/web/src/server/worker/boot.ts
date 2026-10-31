import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { migrateD1 } from "@groot/core/database/d1";
import { kv } from "@groot/core/database/schema";
import { logger } from "@groot/core/logger";
import { r2Media } from "../lib/media";
import { migrations } from "../../../drizzle";
import { startWebApp } from "../app";
import type { WorkerBindings } from "../entry.worker";

type WebApp = ReturnType<typeof startWebApp>;

let ready: Promise<WebApp> | undefined;

/**
 * Boot once per isolate: apply pending migrations, then start the app on D1
 * and R2. `wrangler deploy` is the whole deploy. Later calls reuse the app; a
 * failed boot is retried by the next request instead of being cached.
 */
export function bootWorker(bindings: WorkerBindings, origin: string): Promise<WebApp> {
  ready ??= (async () => {
    const applied = await migrateD1(bindings.DB, migrations);
    const app = startWebApp({
      env: await envSource(bindings, origin),
      db: drizzle(bindings.DB),
      media: r2Media(bindings.MEDIA),
    });
    if (applied.length > 0) logger.info({ applied }, "Database migrations applied");
    return app;
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

/**
 * The env groot validates. With `NODE_ENV=production`, core refuses to boot
 * without JWT_SECRET_KEY, ADMIN_AUTH_KEY, ORIGIN and RP_ID. FeedbackBee deploys
 * with one secret (GITHUB_TOKEN), so when those are unset they are filled in
 * here: the two secrets generated once and kept in core's `kv` table (stable
 * across isolates and deploys), ORIGIN/RP_ID from the request that woke the
 * isolate. Explicit vars and secrets always win.
 */
async function envSource(bindings: WorkerBindings, origin: string) {
  const source: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === "string") source[key] = value;
  }
  if (source.NODE_ENV !== "production") return source;
  const db = drizzle(bindings.DB);
  source.JWT_SECRET_KEY ||= await instanceSecret(db, "feedbackbee:jwt_secret_key");
  source.ADMIN_AUTH_KEY ||= await instanceSecret(db, "feedbackbee:admin_auth_key");
  source.ORIGIN ||= origin;
  source.RP_ID ||= new URL(source.ORIGIN).hostname;
  return source;
}

/** A random secret created on first use and read back on every boot after. */
async function instanceSecret(db: ReturnType<typeof drizzle>, key: string): Promise<string> {
  const read = async () => {
    const [row] = await db.select({ value: kv.value }).from(kv).where(eq(kv.key, key)).limit(1);
    return row ? (JSON.parse(row.value) as string) : undefined;
  };
  const existing = await read();
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const fresh = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  // A racing isolate may have written one first: keep whichever landed.
  await db
    .insert(kv)
    .values({ key, value: JSON.stringify(fresh) })
    .onConflictDoNothing();
  return (await read()) ?? fresh;
}
