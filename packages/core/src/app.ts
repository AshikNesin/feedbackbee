import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { defaultBodyLimit } from "./middlewares/body-limit.middleware";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import { cloudflareRateLimitStore } from "./rate-limit/cloudflare";
import { memoryRateLimitStore, type RateLimitStore } from "./rate-limit/store";
import type { AppEnv } from "./types";
import type { ClientAddressResolver } from "./utils/client-ip";

export interface CreateAppOptions {
  /** Mount feature routers: `app.route("/api/v1/todos", todoRoutes)`. */
  routes?: (app: Hono<AppEnv>) => void;
  /**
   * Readiness probe for `/health` and `/ready`. Return a reason string while
   * the app is not ready and `undefined` once it is.
   */
  readiness?: () => string | undefined;
  /**
   * Max body size for API routes. A route that takes bigger bodies declares
   * its own limit with `routeBodyLimit()` from
   * `@groot/core/middlewares/body-limit.middleware`, and this one skips it.
   */
  bodyLimitBytes?: number;
  /**
   * Paths the body limit skips. Exact paths, or a prefix ending in `*`.
   *
   * @deprecated Declare the limit on the route with `routeBodyLimit()`, which
   * holds wherever the router is mounted; a path here breaks when it moves.
   */
  uploadPaths?: string[];
  /**
   * Who sent a request, for rate limits and request logs (`clientIp(c)`).
   * The Node entry passes the socket peer behind trusted proxies
   * (`peerClientAddress`), Workers `cloudflareClientAddress`; both are in
   * `@groot/core/utils/client-ip`. Default: the @hono/node-server socket when
   * the request has one, else `cf-connecting-ip`.
   */
  clientAddress?: ClientAddressResolver;
  /**
   * Where rate-limit counters live: `memoryRateLimitStore()` or
   * `cloudflareRateLimitStore(bindings)`. Default: a Workers Rate Limiting
   * binding on `c.env` when the limiter names one that exists, else memory.
   * Either way each app gets counters of its own.
   */
  rateLimitStore?: RateLimitStore;
  /**
   * Public endpoints any website may call without credentials (embeddable
   * widgets, tracking pixels): they answer `Access-Control-Allow-Origin: *`
   * and skip the app's credentialed CORS allow-list. Exact paths, or a prefix
   * ending in `*` (`"/api/public/*"`).
   */
  openCorsPaths?: string[];
}

/** True when `path` is one of `paths` (exact, or `prefix*`). */
function matchesPath(paths: readonly string[], path: string): boolean {
  return paths.some((p) => (p.endsWith("*") ? path.startsWith(p.slice(0, -1)) : path === p));
}

let shuttingDown = false;

/** Flip `/health` to 503 so load balancers drain traffic before exit. */
export function markShuttingDown(): void {
  shuttingDown = true;
}

/**
 * The shared Hono app: request context + logging, CORS, body limits, health
 * probes, your routes, then the JSON error envelope. Both the Node and Workers
 * entries call this; only the way it is served differs.
 */
export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const rateLimitMemory = memoryRateLimitStore();

  const openPaths = options.openCorsPaths ?? [];
  const openCors = cors({ origin: "*" });
  const appCors = cors({
    origin: (origin) =>
      config.cors.origins.length === 0 || config.cors.origins.includes(origin) ? origin : null,
    credentials: true,
  });

  // The runtime's pieces first: the request logger already reads clientIp(c).
  app.use((c, next) => {
    if (options.clientAddress) c.set("clientAddress", options.clientAddress);
    c.set(
      "rateLimitStore",
      options.rateLimitStore ?? cloudflareRateLimitStore(c.env ?? {}, rateLimitMemory),
    );
    return next();
  });
  app.use(requestLoggerMiddleware);
  app.use((c, next) => (matchesPath(openPaths, c.req.path) ? openCors(c, next) : appCors(c, next)));
  // Routes that take bigger bodies (storage uploads) declare their own limit.
  const skipPaths = options.uploadPaths ?? [];
  app.use(
    "/api/*",
    defaultBodyLimit(options.bodyLimitBytes ?? 1024 * 1024, (c) =>
      matchesPath(skipPaths, c.req.path),
    ),
  );

  const probe = () => {
    if (shuttingDown) return { status: 503 as const, body: { status: "shutting_down" } };
    const reason = options.readiness?.();
    if (reason) return { status: 503 as const, body: { status: "not_ready", reason } };
    return { status: 200 as const, body: { status: "ok" } };
  };

  app.get("/health", (c) => {
    const { status, body } = probe();
    return c.json({ ...body, timestamp: new Date().toISOString() }, status);
  });
  app.get("/ready", (c) => {
    const { status, body } = probe();
    return c.json(
      status === 200 ? { ready: true } : { ready: false, reason: body.reason ?? body.status },
      status,
    );
  });

  options.routes?.(app);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);
  return app;
}
