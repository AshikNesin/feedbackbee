import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { env } from "../env";
import { sessionLifetimeMs } from "./token";
import type { AppContext } from "../types";

/** The httpOnly cookie that carries the session token for browsers. */
const SESSION_COOKIE = "token";

export function setSessionCookie(c: AppContext, token: string): void {
  const isProduction = env.NODE_ENV === "production";
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "Strict" : "Lax",
    maxAge: Math.floor(sessionLifetimeMs() / 1000),
    path: "/",
  });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** The token from the session cookie, falling back to `Authorization: Bearer`. */
export function readSessionToken(c: AppContext): string | undefined {
  const cookie = getCookie(c, SESSION_COOKIE);
  if (cookie) return cookie;
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return undefined;
}
