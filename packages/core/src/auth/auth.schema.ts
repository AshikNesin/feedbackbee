import { z } from "zod";

// Shared field shapes — composed by the auth schemas below. These are pure
// Zod (no server-only imports) so the client can reuse them for form
// validation (single source of truth).
const emailField = z.email("Invalid email address");
const passwordField = z.string().min(6, "Password must be at least 6 characters");

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginDTO = z.infer<typeof loginSchema>;

/**
 * Create user schema (admin API and first-run setup)
 */
export const createUserSchema = z.object({
  email: emailField,
  password: passwordField,
  name: z.string().min(1, "Name is required").optional(),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;

/**
 * The signed-in user as every sign-in route (`POST /auth/login`,
 * `POST /auth/setup`, `POST /passkey/login/verify`) and `GET /auth/me` return
 * it — the shape the client session store keeps. This is the wire type the
 * client imports (type-only). (`/auth/me` also returns `createdAt`; clients
 * must not rely on it.)
 */
export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
}

/**
 * The body of every sign-in route: the user, and the session token for
 * clients that send `Authorization: Bearer` instead of the cookie.
 */
export interface SignInResponse {
  token: string;
  user: SessionUser;
}

/** `GET /auth/setup`: whether the first account still needs creating. */
export interface SetupStatus {
  needsSetup: boolean;
}
