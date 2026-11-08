import { clearSessionCookie, readSessionToken, setSessionCookie } from "../session/cookie";

// The session cookie now lives in `@groot/core/session`: `startSession` sets
// it, `endSession` clears it and `requireSession` reads it. These aliases keep
// old imports working until the next major.

/** @deprecated Use `startSession` from `@groot/core/session`. */
export const setAuthCookie = setSessionCookie;

/** @deprecated Use `endSession` from `@groot/core/session`. */
export const clearAuthCookie = clearSessionCookie;

/** @deprecated `requireSession` from `@groot/core/session` reads the token. */
export const extractAuthToken = readSessionToken;
