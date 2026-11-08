import { create } from "zustand";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { ApiError, apiClient } from "@groot/shell/lib/api";
import { describeError } from "@groot/shell/lib/feedback";
import type { SessionUser } from "@groot/core/auth/auth.schema";

/** The signed-in user, as `/auth/me` and both sign-in routes return it.
 *  Defined once in `@groot/core` (type-only import, erased at build). */
export type { SessionUser };

interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** False until the first `checkAuth()` settles. */
  hasCheckedAuth: boolean;
  /** Bumped on every sign-in and sign-out. */
  generation: number;

  /** Sign in with email and password. Word a rejection with `loginErrorDescription`. */
  login: (email: string, password: string) => Promise<SessionUser>;
  /**
   * First-run setup: create the first account and sign in as it. The server
   * refuses (403) once any account exists.
   */
  setup: (values: { email: string; password: string; name?: string }) => Promise<SessionUser>;
  /** Sign in with a passkey (WebAuthn). Word a rejection with `loginErrorDescription`. */
  loginWithPasskey: () => Promise<SessionUser>;
  /** Clear the server cookie and the local session. Never rejects. */
  logout: () => Promise<void>;
  /** Resolve the session from the cookie on app load. */
  checkAuth: () => Promise<void>;
  /** End the local session without a server call (the cookie is already gone). */
  clearAuth: () => void;
}

/**
 * The wording a person sees when sign-in fails: `describeError`
 * (`@groot/shell/lib/feedback`), except that a 401 always means "wrong
 * credentials" for the person typing.
 */
export function loginErrorDescription(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 401) return "Invalid email or password.";
  return describeError(error, fallback);
}

async function passkeySignIn(): Promise<SessionUser> {
  const optionsJSON = await apiClient.post<PublicKeyCredentialRequestOptionsJSON>(
    "/passkey/login/options",
    {},
  );
  const response = await startAuthentication({ optionsJSON });
  try {
    const { user } = await apiClient.post<{ user: SessionUser }>("/passkey/login/verify", {
      response,
    });
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new Error("This passkey could not be verified. Try another one or use your password.", {
        cause: error,
      });
    }
    throw error;
  }
}

/** When `generation` last changed (`performance.now()`), for the 401 hook below. */
let generationChangedAt = 0;

/**
 * The client session: who is signed in, how they sign in and out, and what
 * the session guard's 401 means. The server keeps the session in an HttpOnly
 * cookie, so this holds only the user.
 */
export const useAuthStore = create<AuthState>((set) => {
  const change = (user: SessionUser | null) => {
    generationChangedAt = performance.now();
    set((s) => ({ user, isAuthenticated: user !== null, generation: s.generation + 1 }));
  };

  const signIn = async (run: () => Promise<SessionUser>) => {
    try {
      const user = await run();
      change(user);
      return user;
    } catch (error) {
      set({ user: null, isAuthenticated: false });
      throw error;
    }
  };

  return {
    user: null,
    isAuthenticated: false,
    hasCheckedAuth: false,
    generation: 0,

    login: (email, password) =>
      signIn(async () => {
        const { user } = await apiClient.post<{ user: SessionUser }>("/auth/login", {
          email,
          password,
        });
        return user;
      }),

    setup: (values) =>
      signIn(async () => {
        const { user } = await apiClient.post<{ user: SessionUser }>("/auth/setup", values);
        return user;
      }),

    loginWithPasskey: () => signIn(passkeySignIn),

    logout: async () => {
      try {
        await apiClient.post("/auth/logout");
      } catch {
        // An expired cookie answers 401; the local session ends either way.
      }
      change(null);
    },

    checkAuth: async () => {
      let user: SessionUser | null = null;
      try {
        user = await apiClient.get<SessionUser>("/auth/me");
      } catch {
        // No session cookie, or an expired one.
      }
      change(user);
      set({ hasCheckedAuth: true });
    },

    clearAuth: () => change(null),
  };
});

apiClient.onUnauthorized(({ sentAt }) => {
  if (useAuthStore.getState().isAuthenticated && sentAt >= generationChangedAt) {
    useAuthStore.getState().clearAuth();
  }
});
