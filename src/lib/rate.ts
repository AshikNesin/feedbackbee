const LIMIT = 20;
const WINDOW_MS = 3600_000;

export type RateResult = { allowed: true } | { allowed: false; retryAfter: number };

export async function checkRate(db: D1Database, key: string, now = Date.now()): Promise<RateResult> {
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limit WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || now - row.window_start >= WINDOW_MS) {
    await db
      .prepare(
        "INSERT INTO rate_limit (key, count, window_start) VALUES (?1, 1, ?2) " +
          "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?2",
      )
      .bind(key, now)
      .run();
    return { allowed: true };
  }

  if (row.count >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((row.window_start + WINDOW_MS - now) / 1000) };
  }

  await db
    .prepare("UPDATE rate_limit SET count = count + 1 WHERE key = ?")
    .bind(key)
    .run();
  return { allowed: true };
}
