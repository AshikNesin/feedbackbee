import { createMiddleware } from "hono/factory";
import { Boom, ErrorCode, type HttpError } from "../errors";
import { findUserById } from "../auth/auth.service";
import type { SessionUser, SignInResponse } from "../auth/auth.schema";
import type { AppContext, AppEnv, AuthUser } from "../types";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./cookie";
import { decodeSessionToken, issueSession } from "./token";

/**
 * The server session, start to end. A sign-in path (password, first-run setup,
 * passkey) proves who the user is and calls `startSession` once; protected
 * routes run `requireSession`; logout calls `endSession`. The token is a JWT
 * carried in the httpOnly `token` cookie for browsers and returned in the body
 * for clients that send `Authorization: Bearer`.
 */

/**
 * The guard's 401, coded `SESSION_INVALID`: the client signs the owner out on
 * it. Module-private so nothing else can throw it; a wrong password or an
 * unknown passkey is a plain `Boom.unauthorized`.
 */
function sessionInvalid(message: string): HttpError {
  return Boom.unauthorized(message, undefined, ErrorCode.SESSION_INVALID.code);
}

/**
 * Sign `account` in: mint its token, set the session cookie, and return the
 * response body every sign-in route sends, `{ token, user }`. `account` may be
 * any user record; `user` is always exactly the `SessionUser` fields.
 */
export async function startSession(c: AppContext, account: SessionUser): Promise<SignInResponse> {
  const body = await issueSession(account);
  setSessionCookie(c, body.token);
  return body;
}

/** Sign out: clear the session cookie. A bearer token stays valid until it expires. */
export function endSession(c: AppContext): void {
  clearSessionCookie(c);
}

/** The claims of a valid session token; throws the `SESSION_INVALID` 401 otherwise. */
export async function verifySessionToken(token: string): Promise<AuthUser> {
  const claims = await decodeSessionToken(token);
  if (!claims) throw sessionInvalid("Invalid or expired token");
  return claims;
}

/**
 * The session guard: requires a valid token (cookie, else bearer) for an
 * account that still exists, and sets `c.get("user")`.
 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = readSessionToken(c);
  if (!token) throw sessionInvalid("No token provided");
  const account = await findUserById((await verifySessionToken(token)).userId);
  if (!account) throw sessionInvalid("Account no longer exists");
  c.set("user", { userId: account.id, email: account.email });
  await next();
});
