import { describe, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";
import { createApp } from "@groot/core/app";
import { rateLimit } from "@groot/core/middlewares/rate-limit.middleware";
import { cloudflareRateLimitStore } from "@groot/core/rate-limit/cloudflare";
import {
  memoryRateLimitStore,
  type RateLimitRule,
  type RateLimitStore,
} from "@groot/core/rate-limit/store";
import { ok } from "@groot/core/utils/api-response.utils";
import type { AppEnv } from "@groot/core/types";

/**
 * The rate-limit store contract (packages/core/src/rate-limit/store.ts), run
 * once per adapter. The Cloudflare store runs against a fake binding that
 * counts like the real one: a fixed window per key, with the limit and period
 * that `wrangler.jsonc` would give it (here, the rule's own).
 */

function fakeRateLimitBinding(limit: number, periodMs: number) {
  const windows = new Map<string, { count: number; endsAt: number }>();
  return {
    async limit({ key }: { key: string }) {
      const now = Date.now();
      let window = windows.get(key);
      if (!window || window.endsAt <= now) {
        window = { count: 0, endsAt: now + periodMs };
        windows.set(key, window);
      }
      window.count += 1;
      return { success: window.count <= limit };
    },
  };
}

const auth: RateLimitRule = { name: "auth", windowMs: 60_000, max: 2, binding: "AUTH_LIMITER" };
const upload: RateLimitRule = {
  name: "upload",
  windowMs: 60_000,
  max: 2,
  binding: "UPLOAD_LIMITER",
};

const stores: Array<{ name: string; create: () => RateLimitStore; reportsCounts: boolean }> = [
  { name: "memory", create: memoryRateLimitStore, reportsCounts: true },
  {
    name: "Cloudflare binding",
    create: () =>
      cloudflareRateLimitStore({
        AUTH_LIMITER: fakeRateLimitBinding(auth.max, auth.windowMs),
        UPLOAD_LIMITER: fakeRateLimitBinding(upload.max, upload.windowMs),
      }),
    reportsCounts: false,
  },
];

async function hits(store: RateLimitStore, key: string, rule: RateLimitRule, times: number) {
  const allowed: boolean[] = [];
  for (let i = 0; i < times; i++) allowed.push((await store.hit(key, rule)).allowed);
  return allowed;
}

describe.each(stores)("$name rate-limit store", ({ create, reportsCounts }) => {
  it("allows `max` hits per key in a window, then refuses", async () => {
    expect(await hits(create(), "203.0.113.5", auth, 3)).toEqual([true, true, false]);
  });

  it("counts each key on its own", async () => {
    const store = create();
    await hits(store, "203.0.113.5", auth, 3);
    expect((await store.hit("203.0.113.6", auth)).allowed).toBe(true);
  });

  it("counts each rule on its own", async () => {
    const store = create();
    await hits(store, "203.0.113.5", auth, 3);
    expect((await store.hit("203.0.113.5", upload)).allowed).toBe(true);
  });

  it("allows the key again once the window has passed", async () => {
    const store = create();
    await hits(store, "203.0.113.5", auth, 3);
    vi.setSystemTime(Date.now() + auth.windowMs);
    expect((await store.hit("203.0.113.5", auth)).allowed).toBe(true);
  });

  it("starts every store empty", async () => {
    await hits(create(), "203.0.113.5", auth, 3);
    expect((await create().hit("203.0.113.5", auth)).allowed).toBe(true);
  });

  it(`${reportsCounts ? "reports" : "does not report"} the limit, remaining count and reset`, async () => {
    const store = create();
    const first = await store.hit("203.0.113.5", auth);
    if (reportsCounts) {
      expect(first).toEqual({
        allowed: true,
        limit: 2,
        remaining: 1,
        resetAt: Date.now() + auth.windowMs,
      });
    } else {
      expect(first).toEqual({ allowed: true });
    }
  });
});

describe("Cloudflare rate-limit store", () => {
  it("falls back to the given store for a rule whose binding is not bound", async () => {
    const store = cloudflareRateLimitStore({}, memoryRateLimitStore());
    expect((await store.hit("203.0.113.5", auth)).remaining).toBe(1);
  });

  it("passes the key to the rule's binding", async () => {
    const keys: string[] = [];
    const store = cloudflareRateLimitStore({
      AUTH_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: true };
        },
      },
    });
    await store.hit("2001:db8:1:2::/64", auth);
    expect(keys).toEqual(["2001:db8:1:2::/64"]);
  });
});

describe("rateLimit headers", () => {
  function buildApp(store?: RateLimitStore) {
    return createApp({
      clientAddress: () => "203.0.113.5",
      rateLimitStore: store,
      routes(app) {
        const r = new Hono<AppEnv>();
        r.get(
          "/limited",
          rateLimit({
            window: () => ({ windowMs: 60_000, max: 1 }),
            message: "slow down",
            binding: "AUTH_LIMITER",
          }),
          (c) => ok(c, { fine: true }),
        );
        app.route("/api/v1", r);
      },
    });
  }

  it("sends RateLimit-* headers, and Retry-After on a 429, when the store reports counts", async () => {
    const app = buildApp(memoryRateLimitStore());
    const first = await app.request("/api/v1/limited");
    expect(first.status).toBe(200);
    expect(first.headers.get("RateLimit-Limit")).toBe("1");
    expect(first.headers.get("RateLimit-Remaining")).toBe("0");
    expect(first.headers.get("RateLimit-Reset")).toBe("60");
    const second = await app.request("/api/v1/limited");
    expect(second.status).toBe(429);
    expect(second.headers.get("RateLimit-Remaining")).toBe("0");
    expect(second.headers.get("Retry-After")).toBe("60");
  });

  it("sends none when the binding decides, since it reports no counts", async () => {
    const app = buildApp(
      cloudflareRateLimitStore({ AUTH_LIMITER: fakeRateLimitBinding(1, 60_000) }),
    );
    const first = await app.request("/api/v1/limited");
    expect(first.status).toBe(200);
    expect(first.headers.get("RateLimit-Limit")).toBeNull();
    const second = await app.request("/api/v1/limited");
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeNull();
  });

  it("without a store, prefers a binding the request's environment provides", async () => {
    const app = buildApp();
    const bindings = { AUTH_LIMITER: fakeRateLimitBinding(1, 60_000) };
    expect((await app.request("/api/v1/limited", {}, bindings)).status).toBe(200);
    expect((await app.request("/api/v1/limited", {}, bindings)).status).toBe(429);
    // Without the binding the app's own memory counts, from zero.
    expect((await app.request("/api/v1/limited")).status).toBe(200);
  });
});
