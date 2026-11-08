import { memoryRateLimitStore, type RateLimitStore } from "./store";

/** The part of a Workers Rate Limiting binding the store calls. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

function isBinding(value: unknown): value is RateLimitBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<RateLimitBinding>).limit === "function"
  );
}

/**
 * Counts each rule in the Workers Rate Limiting binding its `binding` names
 * (`AUTH_RATE_LIMITER`, ...), which is shared by every isolate. The binding
 * enforces the limit and period set in `wrangler.jsonc`, not the rule's
 * `windowMs` and `max`, and answers only yes or no: it reports no remaining
 * count or reset time, so responses it decides carry no `RateLimit-*`
 * headers. A rule whose binding is absent falls back to `fallback`
 * (per-isolate memory by default).
 */
export function cloudflareRateLimitStore(
  bindings: Record<string, unknown>,
  fallback: RateLimitStore = memoryRateLimitStore(),
): RateLimitStore {
  return {
    async hit(key, rule) {
      const binding = rule.binding === undefined ? undefined : bindings[rule.binding];
      if (!isBinding(binding)) return fallback.hit(key, rule);
      const { success } = await binding.limit({ key });
      return { allowed: success };
    },
  };
}
