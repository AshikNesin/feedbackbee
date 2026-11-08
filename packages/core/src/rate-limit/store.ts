/**
 * The rate-limit store contract. Two adapters ship: in-memory counters
 * (`memoryRateLimitStore`, exact on one Node process, per isolate on Workers)
 * and Cloudflare's Rate Limiting binding (`./cloudflare`).
 * `tests/server/core/rate-limit-stores.test.ts` runs one contract suite
 * against both; a new adapter should pass it too.
 *
 * `rateLimit()` asks the store once per request. Each `createApp()` call
 * gets its own store (see `CreateAppOptions.rateLimitStore`), so two apps in
 * one process, such as two test apps, never share counters.
 */

/** One limiter's rule, as the store sees it. */
export interface RateLimitRule {
  /** Tells limiters apart in a shared store: each keeps its own counters. */
  name: string;
  windowMs: number;
  max: number;
  /** Workers Rate Limiting binding that counts this rule in the Cloudflare store. */
  binding?: string;
}

/**
 * The verdict for one request. A store that knows more reports it, and the
 * middleware turns it into `RateLimit-*` headers; one that does not (the
 * Cloudflare binding answers only yes or no) leaves the fields out.
 */
export interface RateLimitHit {
  allowed: boolean;
  /** The limit enforced for this window. */
  limit?: number;
  /** Requests left in this window after this one. */
  remaining?: number;
  /** When the window resets, in epoch milliseconds. */
  resetAt?: number;
}

export interface RateLimitStore {
  /** Count one request from `key` against `rule` and say whether it may pass. */
  hit(key: string, rule: RateLimitRule): Promise<RateLimitHit>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counters in a Map. Exact within one process; on Workers each
 * isolate counts on its own. Expired buckets are swept at most once a minute.
 */
export function memoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  const sweep = (now: number) => {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [id, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(id);
  };

  return {
    async hit(key, rule) {
      const now = Date.now();
      sweep(now);
      const id = `${rule.name}\u0000${key}`;
      let bucket = buckets.get(id);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + rule.windowMs };
        buckets.set(id, bucket);
      }
      bucket.count += 1;
      return {
        allowed: bucket.count <= rule.max,
        limit: rule.max,
        remaining: Math.max(0, rule.max - bucket.count),
        resetAt: bucket.resetAt,
      };
    },
  };
}
