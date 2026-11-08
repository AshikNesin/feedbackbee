import { verifySessionToken } from "../session";
import { sessionLifetimeMs, signSessionToken } from "../session/token";

// The session token now lives in `@groot/core/session`. These aliases keep old
// imports working until the next major.

/** @deprecated Sign in with `startSession` from `@groot/core/session`, or `signSessionToken` from `@groot/core/session/token`. */
export const generateToken = signSessionToken;

/** @deprecated Use `verifySessionToken` from `@groot/core/session`, or guard routes with `requireSession`. */
export const verifyToken = verifySessionToken;

/** @deprecated Use `sessionLifetimeMs` from `@groot/core/session/token`. */
export const jwtExpiresInMs = sessionLifetimeMs;
