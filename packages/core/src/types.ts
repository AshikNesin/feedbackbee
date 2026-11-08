import type { Context, MiddlewareHandler } from "hono";
import type { Logger } from "./logger";
import type { RateLimitStore } from "./rate-limit/store";
import type { ClientAddressResolver } from "./utils/client-ip";

export interface AuthUser {
  userId: number;
  email: string;
}

/**
 * Hono environment shared by every router in the app. `Bindings` is the
 * Workers `env` object (empty on Node); `Variables` are set per request.
 */
export type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: {
    user?: AuthUser;
    logger: Logger;
    requestId: string;
    /** Set by `createApp()` when the runtime supplies one; `clientIp(c)` reads it. */
    clientAddress?: ClientAddressResolver;
    /** Set by `createApp()`: this app's rate-limit counters. */
    rateLimitStore?: RateLimitStore;
  };
};

export type AppContext = Context<AppEnv>;
export type Middleware = MiddlewareHandler<AppEnv>;
