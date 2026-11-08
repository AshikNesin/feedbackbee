import { afterEach, describe, expect, it } from "vite-plus/test";
import { Hono } from "hono";
import { createApp, type CreateAppOptions } from "@groot/core/app";
import { rateLimit } from "@groot/core/middlewares/rate-limit.middleware";
import { ok } from "@groot/core/utils/api-response.utils";
import { peerClientAddress } from "@groot/core/utils/client-ip";
import type { AppEnv } from "@groot/core/types";
import * as authService from "@groot/core/auth/auth.service";
import { createTestApp, setAppConfig } from "../helpers";

/**
 * The tests stand in for the Node entry's socket with a header: the app is
 * given `peerClientAddress` (the resolver the Node entry uses) reading the
 * peer from `x-test-peer` instead of from the socket.
 */
const fromTestPeer = peerClientAddress((c) => c.req.header("x-test-peer"));

function buildApp(options: Omit<CreateAppOptions, "routes"> = { clientAddress: fromTestPeer }) {
  return createApp({
    ...options,
    routes(app) {
      const r = new Hono<AppEnv>();
      r.get(
        "/limited",
        rateLimit({
          window: () => ({ windowMs: 60_000, max: 2 }),
          message: "slow down",
          binding: "TEST_LIMITER",
        }),
        (c) => ok(c, { fine: true }),
      );
      app.route("/api/v1", r);
    },
  });
}

type TestApp = ReturnType<typeof buildApp>;

function fromPeer(app: TestApp, peer: string, forwardedFor?: string) {
  const headers: Record<string, string> = { "x-test-peer": peer };
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  return app.request("/api/v1/limited", { headers });
}

afterEach(() => {
  setAppConfig();
});

describe("rateLimit middleware", () => {
  it("counts per client within the window and sets standard headers", async () => {
    const app = buildApp();
    const first = await fromPeer(app, "203.0.113.5");
    expect(first.status).toBe(200);
    expect(first.headers.get("RateLimit-Limit")).toBe("2");
    expect(first.headers.get("RateLimit-Remaining")).toBe("1");
    expect((await fromPeer(app, "203.0.113.5")).status).toBe(200);
    const third = await fromPeer(app, "203.0.113.5");
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({
      error: { code: "TOO_MANY_REQUESTS", message: "slow down" },
    });
    expect((await fromPeer(app, "203.0.113.6")).status).toBe(200);
  });

  it("ignores X-Forwarded-For from a public peer under the default trust", async () => {
    const app = buildApp();
    expect((await fromPeer(app, "203.0.113.5", "198.51.100.1")).status).toBe(200);
    expect((await fromPeer(app, "203.0.113.5", "198.51.100.2")).status).toBe(200);
    expect((await fromPeer(app, "203.0.113.5", "198.51.100.3, 10.0.0.1")).status).toBe(429);
  });

  it("gives each client behind a loopback proxy its own bucket under the default trust", async () => {
    const app = buildApp();
    for (let i = 0; i < 2; i++) {
      expect((await fromPeer(app, "127.0.0.1", "198.51.100.1")).status).toBe(200);
    }
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.1")).status).toBe(429);
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.2")).status).toBe(200);
  });

  it("ignores X-Forwarded-For even from loopback when no proxy is trusted", async () => {
    setAppConfig({ trustedProxies: [] });
    const app = buildApp();
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.1")).status).toBe(200);
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.2")).status).toBe(200);
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.3")).status).toBe(429);
  });

  it("ignores X-Forwarded-For from a peer outside an explicit proxy list", async () => {
    setAppConfig({ trustedProxies: ["192.0.2.10"] });
    const app = buildApp();
    expect((await fromPeer(app, "10.0.0.2", "198.51.100.1")).status).toBe(200);
    expect((await fromPeer(app, "10.0.0.2", "198.51.100.2")).status).toBe(200);
    expect((await fromPeer(app, "10.0.0.2", "198.51.100.3")).status).toBe(429);
  });

  it("takes the rightmost hop that is not a trusted proxy, so a client cannot prepend its way out", async () => {
    const app = buildApp();
    expect((await fromPeer(app, "10.0.0.2", "1.1.1.1, 198.51.100.7, 10.0.0.3")).status).toBe(200);
    expect((await fromPeer(app, "10.0.0.2", "2.2.2.2, 198.51.100.7")).status).toBe(200);
    expect((await fromPeer(app, "10.0.0.2", "198.51.100.7")).status).toBe(429);
    expect((await fromPeer(app, "10.0.0.2", "198.51.100.7, 198.51.100.8")).status).toBe(200);
  });

  it("matches an IPv4 peer reported in IPv4-mapped IPv6 form", async () => {
    const app = buildApp();
    for (let i = 0; i < 2; i++) {
      expect((await fromPeer(app, "::ffff:10.0.0.2", "198.51.100.1")).status).toBe(200);
    }
    expect((await fromPeer(app, "::ffff:10.0.0.2", "198.51.100.1")).status).toBe(429);
    expect((await fromPeer(app, "::ffff:10.0.0.2", "198.51.100.2")).status).toBe(200);
  });

  it("keys an IPv6 client by its /64, so rotating addresses inside it shares one limit", async () => {
    const app = buildApp();
    expect((await fromPeer(app, "2001:db8:1:2::1")).status).toBe(200);
    expect((await fromPeer(app, "2001:db8:1:2:ffff::2")).status).toBe(200);
    expect((await fromPeer(app, "2001:0db8:0001:0002::3")).status).toBe(429);
    expect((await fromPeer(app, "2001:db8:1:3::1")).status).toBe(200);
  });

  it("keeps the IPv4 key for an IPv4-mapped address in either notation", async () => {
    const app = buildApp();
    expect((await fromPeer(app, "127.0.0.1", "::ffff:c633:6401")).status).toBe(200);
    expect((await fromPeer(app, "127.0.0.1", "198.51.100.1")).status).toBe(200);
    expect((await fromPeer(app, "127.0.0.1", "::ffff:198.51.100.1")).status).toBe(429);
    expect((await fromPeer(app, "127.0.0.1", "::ffff:c633:6402")).status).toBe(200);
  });

  it("trusts a unique-local IPv6 proxy under the default trust", async () => {
    const app = buildApp();
    for (let i = 0; i < 2; i++) {
      expect((await fromPeer(app, "fd00::1", "2001:db8:7::1")).status).toBe(200);
    }
    expect((await fromPeer(app, "fd00::1", "2001:db8:7::1")).status).toBe(429);
    expect((await fromPeer(app, "fd00::1", "2001:db8:8::1")).status).toBe(200);
  });

  it("trusts a proxy inside an IPv6 range in an explicit proxy list", async () => {
    setAppConfig({ trustedProxies: ["2001:db8:ffff::/48"] });
    const app = buildApp();
    for (let i = 0; i < 2; i++) {
      expect((await fromPeer(app, "2001:db8:ffff:1::5", "198.51.100.1")).status).toBe(200);
    }
    expect((await fromPeer(app, "2001:db8:ffff:1::5", "198.51.100.1")).status).toBe(429);
    expect((await fromPeer(app, "2001:db8:ffff:1::5", "198.51.100.2")).status).toBe(200);
    expect((await fromPeer(app, "fd00::1", "198.51.100.3")).status).toBe(200);
    expect((await fromPeer(app, "fd00::1", "198.51.100.4")).status).toBe(200);
    expect((await fromPeer(app, "fd00::1", "198.51.100.5")).status).toBe(429);
  });

  it("reads an IPv4-mapped range's prefix in IPv6 terms and never trusts one with host bits set", async () => {
    setAppConfig({ trustedProxies: ["::ffff:10.0.0.0/104"] });
    const app = buildApp();
    for (let i = 0; i < 2; i++) {
      expect((await fromPeer(app, "10.9.9.9", "198.51.100.1")).status).toBe(200);
    }
    expect((await fromPeer(app, "10.9.9.9", "198.51.100.2")).status).toBe(200);
    setAppConfig({ trustedProxies: ["::ffff:10.0.0.0/8", "fd00::1/0"] });
    expect((await fromPeer(app, "203.0.113.9", "6.6.6.1")).status).toBe(200);
    expect((await fromPeer(app, "203.0.113.9", "6.6.6.2")).status).toBe(200);
    expect((await fromPeer(app, "203.0.113.9", "6.6.6.3")).status).toBe(429);
  });

  it("gives each app its own counters", async () => {
    const first = buildApp();
    for (let i = 0; i < 2; i++) expect((await fromPeer(first, "203.0.113.5")).status).toBe(200);
    expect((await fromPeer(first, "203.0.113.5")).status).toBe(429);
    expect((await fromPeer(buildApp(), "203.0.113.5")).status).toBe(200);
  });

  it("keys every request on one `unknown` bucket when the resolver cannot tell", async () => {
    const app = buildApp({ clientAddress: () => undefined });
    expect((await fromPeer(app, "198.51.100.1")).status).toBe(200);
    expect((await fromPeer(app, "198.51.100.2")).status).toBe(200);
    expect((await fromPeer(app, "198.51.100.3")).status).toBe(429);
  });

  it("without a resolver, reads @hono/node-server's socket peer, else cf-connecting-ip", async () => {
    const app = buildApp({});
    const socket = (peer: string) => ({ incoming: { socket: { remoteAddress: peer } } });
    const viaSocket = (peer: string, forwardedFor: string) =>
      app.request(
        "/api/v1/limited",
        { headers: { "x-forwarded-for": forwardedFor } },
        socket(peer),
      );
    expect((await viaSocket("127.0.0.1", "198.51.100.1")).status).toBe(200);
    expect((await viaSocket("127.0.0.1", "198.51.100.1")).status).toBe(200);
    expect((await viaSocket("127.0.0.1", "198.51.100.1")).status).toBe(429);
    expect((await viaSocket("127.0.0.1", "198.51.100.2")).status).toBe(200);
    const viaEdge = (ip: string) =>
      app.request("/api/v1/limited", { headers: { "cf-connecting-ip": ip } });
    expect((await viaEdge("192.0.2.1")).status).toBe(200);
    expect((await viaEdge("192.0.2.1")).status).toBe(200);
    expect((await viaEdge("192.0.2.1")).status).toBe(429);
    expect((await viaEdge("192.0.2.2")).status).toBe(200);
  });
});

describe("sign-in rate limit", () => {
  it("limits a client that rotates addresses inside one IPv6 /64", async () => {
    const app = createTestApp({ clientAddress: fromTestPeer });
    // A user exists, so every attempt is a wrong password: a child whose first
    // sign-in creates the owner (on an empty users table) answers 401 here too.
    await authService.createUser({
      email: "owner@example.com",
      password: "correct horse battery staple",
      name: "Owner",
    });
    const statuses: number[] = [];
    for (let i = 1; i <= 25; i++) {
      const response = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-peer": `2001:db8:5:6::${i.toString(16)}`,
        },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
      });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([...Array<number>(20).fill(401), ...Array<number>(5).fill(429)]);
  });
});
