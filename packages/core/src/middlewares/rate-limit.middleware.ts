import { createMiddleware } from "hono/factory";
import { Boom, ErrorCode, type ErrorCodeValue } from "../errors";
import { config, type RateLimitWindow } from "../config";
import { cloudflareRateLimitStore } from "../rate-limit/cloudflare";
import { memoryRateLimitStore, type RateLimitStore } from "../rate-limit/store";
import { rateLimitKey } from "../utils/client-address";
import { clientIp } from "../utils/controller.utils";
import type { AppContext, AppEnv } from "../types";

/**
 * Fixed-window rate limiting keyed by client IP (`clientIp(c)`), or its /64
 * for IPv6. The counters live in the app's `RateLimitStore`, which the
 * runtime passes to `createApp({ rateLimitStore })`: memory on Node,
 * Cloudflare's Rate Limiting binding on Workers. An app given no store uses
 * a binding named by the limiter's `binding` when `c.env` has one, and its
 * own in-memory counters otherwise.
 *
 * Every response the store can describe carries `RateLimit-Limit`,
 * `RateLimit-Remaining` and `RateLimit-Reset` (seconds), and a 429 also
 * `Retry-After`. The Cloudflare binding answers only allowed or not, so its
 * responses carry none of them.
 */
export interface RateLimitOptions {
  /** Read lazily so app config overrides apply. */
  window: () => RateLimitWindow;
  message: string;
  code?: ErrorCodeValue;
  /**
   * Tells this limiter's counters apart in the app's store. Defaults to
   * `binding`, else a name unique to this limiter.
   */
  name?: string;
  /** Name of the Workers Rate Limiting binding that counts this limiter. */
  binding?: string;
}

let unnamed = 0;

/** The store `createApp()` gave this request, else bindings on `c.env`, else process memory. */
let processStore: RateLimitStore | undefined;
function storeFor(c: AppContext): RateLimitStore {
  const store = c.get("rateLimitStore");
  if (store) return store;
  processStore ??= memoryRateLimitStore();
  return cloudflareRateLimitStore(c.env ?? {}, processStore);
}

export function rateLimit(options: RateLimitOptions) {
  unnamed += 1;
  const name = options.name ?? options.binding ?? `rate-limit-${unnamed}`;

  return createMiddleware<AppEnv>(async (c, next) => {
    const { windowMs, max } = options.window();
    const key = rateLimitKey(clientIp(c));
    const result = await storeFor(c).hit(key, { name, windowMs, max, binding: options.binding });

    const resetSeconds =
      result.resetAt === undefined
        ? undefined
        : String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000)));
    if (result.limit !== undefined) c.header("RateLimit-Limit", String(result.limit));
    if (result.remaining !== undefined) c.header("RateLimit-Remaining", String(result.remaining));
    if (resetSeconds !== undefined) c.header("RateLimit-Reset", resetSeconds);

    if (!result.allowed) {
      if (resetSeconds !== undefined) c.header("Retry-After", resetSeconds);
      throw Boom.tooManyRequests(options.message, null, options.code);
    }
    await next();
  });
}

export const authRateLimiter = rateLimit({
  window: () => config.rateLimits.auth,
  message: "Too many attempts",
  code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
  binding: "AUTH_RATE_LIMITER",
});

export const storageRateLimiter = rateLimit({
  window: () => config.rateLimits.storage,
  message: "Too many storage operations from this IP, please try again later.",
  code: ErrorCode.RATE_LIMIT_EXCEEDED.code,
  binding: "STORAGE_RATE_LIMITER",
});

export const uploadRateLimiter = rateLimit({
  window: () => config.rateLimits.upload,
  message: "Too many file uploads from this IP, please try again later.",
  code: ErrorCode.UPLOAD_RATE_LIMIT_EXCEEDED.code,
  binding: "UPLOAD_RATE_LIMITER",
});
