import { describe, expect, it } from "vite-plus/test";
import { requireSession, verifySessionToken } from "@groot/core/session";
import { sessionLifetimeMs, signSessionToken } from "@groot/core/session/token";
import * as cookie from "@groot/core/session/cookie";
import * as jwtUtils from "@groot/core/utils/jwt.utils";
import * as authCookie from "@groot/core/utils/auth-cookie.utils";
import { jwtAuthMiddleware } from "@groot/core/middlewares/jwt-auth.middleware";
import { Boom } from "@groot/core/errors";

describe("session token", () => {
  it("round-trips the user claims", async () => {
    const token = await signSessionToken({ userId: 7, email: "a@b.c" });
    expect(await verifySessionToken(token)).toEqual({ userId: 7, email: "a@b.c" });
  });

  it("rejects tampered or garbage tokens with the SESSION_INVALID 401", async () => {
    const token = await signSessionToken({ userId: 7, email: "a@b.c" });
    const tampered = `${token.slice(0, -2)}xx`;
    for (const bad of [tampered, "not-a-token", ""]) {
      const error = await verifySessionToken(bad).catch((e: unknown) => e);
      expect(Boom.isHttpError(error) && [error.statusCode, error.code]).toEqual([
        401,
        "SESSION_INVALID",
      ]);
    }
  });

  it("derives the cookie lifetime from config", () => {
    expect(sessionLifetimeMs()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("keeps the deprecated jwt, cookie and middleware names working", () => {
    expect(jwtUtils.generateToken).toBe(signSessionToken);
    expect(jwtUtils.verifyToken).toBe(verifySessionToken);
    expect(jwtUtils.jwtExpiresInMs).toBe(sessionLifetimeMs);
    expect(authCookie.setAuthCookie).toBe(cookie.setSessionCookie);
    expect(authCookie.clearAuthCookie).toBe(cookie.clearSessionCookie);
    expect(authCookie.extractAuthToken).toBe(cookie.readSessionToken);
    expect(jwtAuthMiddleware).toBe(requireSession);
  });
});
