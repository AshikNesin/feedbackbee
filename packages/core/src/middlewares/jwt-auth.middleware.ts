import { requireSession } from "../session";

/** @deprecated Use `requireSession` from `@groot/core/session`; this alias goes in the next major. */
export const jwtAuthMiddleware = requireSession;
