import { eq, sql } from "drizzle-orm";
import { db, rateLimits } from "../db";

const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

export type RateResult = { allowed: true } | { allowed: false; retryAfter: number };

/**
 * Fixed window: `LIMIT` hits per `key` per hour, counted in D1. groot's
 * `rateLimit()` middleware keeps counters per isolate, which on Workers is not
 * one counter, and Cloudflare's binding only offers 10 s / 60 s windows.
 */
export async function checkRate(key: string, now = Date.now()): Promise<RateResult> {
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!row || now - row.windowStart >= WINDOW_MS) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: now } });
    return { allowed: true };
  }
  if (row.count >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((row.windowStart + WINDOW_MS - now) / 1000) };
  }
  await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));
  return { allowed: true };
}
