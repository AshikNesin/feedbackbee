/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GrootUIProvider } from "@groot/ui/provider";
import { apiClient } from "@groot/shell/lib/api";
import {
  SHELL_QUERY_DEFAULTS,
  ShellQueryProvider,
  createShellQueryClient,
} from "@groot/shell/lib/query-client";
import { PasskeyManager } from "@groot/shell/components/PasskeyManager";
import { useAuthStore } from "@groot/shell/store/auth";

const ALICE = { id: 1, email: "alice@example.com", name: "Alice" };
const BOB = { id: 2, email: "bob@example.com", name: "Bob" };

const passkey = (id: number, credentialName: string) => ({
  id,
  credentialName,
  kind: "device",
  label: "This device",
  backedUp: false,
  canDelete: true,
  lastUsedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const PASSKEYS: Record<number, ReturnType<typeof passkey>[]> = {
  [ALICE.id]: [passkey(11, "Alice's laptop")],
  [BOB.id]: [passkey(21, "Bob's phone")],
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: unknown) => json(200, { success: true, data });
const sessionInvalid = () =>
  json(401, { success: false, error: { code: "SESSION_INVALID", message: "Session expired" } });

/**
 * A fake server with a cookie session: `/auth/login` signs in whoever
 * `nextUser` names, `/passkey/list` answers for the signed-in user.
 */
function serve() {
  const server = {
    nextUser: ALICE,
    signedIn: null as typeof ALICE | null,
    passkeyListCalls: 0,
  };
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/v1", "");
    if (path === "/auth/login") {
      server.signedIn = server.nextUser;
      return ok({ user: server.signedIn });
    }
    if (path === "/auth/logout") {
      server.signedIn = null;
      return ok({});
    }
    if (!server.signedIn) return sessionInvalid();
    if (path === "/passkey/list") {
      server.passkeyListCalls += 1;
      return ok(PASSKEYS[server.signedIn.id]);
    }
    return json(404, { success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });
  return server;
}

const client = () => createShellQueryClient({ queries: { retry: false } });

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, hasCheckedAuth: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createShellQueryClient", () => {
  it("owns the defaults and merges overrides per section", () => {
    const options = client().getDefaultOptions();
    expect(options.queries).toMatchObject({
      staleTime: SHELL_QUERY_DEFAULTS.queries.staleTime,
      gcTime: SHELL_QUERY_DEFAULTS.queries.gcTime,
      retry: false,
    });
    expect(options.mutations).toMatchObject({ retry: false });
  });
});

describe("ShellQueryProvider", () => {
  it("never shows one account's cached data to the next (#4)", async () => {
    const server = serve();
    await useAuthStore.getState().login(ALICE.email, "secret");

    render(
      <ShellQueryProvider client={client()}>
        <GrootUIProvider>
          <PasskeyManager />
        </GrootUIProvider>
      </ShellQueryProvider>,
    );
    expect(await screen.findByText("Alice's laptop")).toBeInTheDocument();
    expect(server.passkeyListCalls).toBe(1);

    await useAuthStore.getState().logout();
    await waitFor(() => expect(screen.queryByText("Alice's laptop")).not.toBeInTheDocument());

    // Within the 5-minute staleTime: without the reset Bob would see Alice's list.
    server.nextUser = BOB;
    await useAuthStore.getState().login(BOB.email, "secret");
    expect(await screen.findByText("Bob's phone")).toBeInTheDocument();
    expect(screen.queryByText("Alice's laptop")).not.toBeInTheDocument();
    expect(server.passkeyListCalls).toBe(2);
  });

  it("drops cached data when the session guard ends the session", async () => {
    serve();
    await useAuthStore.getState().login(ALICE.email, "secret");
    const queryClient = client();
    const { unmount } = render(
      <ShellQueryProvider client={queryClient}>
        <GrootUIProvider>
          <PasskeyManager />
        </GrootUIProvider>
      </ShellQueryProvider>,
    );
    expect(await screen.findByText("Alice's laptop")).toBeInTheDocument();

    // Leave the page (the query goes inactive but stays cached), keep the binding.
    unmount();
    const binding = render(<ShellQueryProvider client={queryClient}>{null}</ShellQueryProvider>);
    expect(queryClient.getQueryData(["passkeys"])).toHaveLength(1);

    // The cookie expires: the next request is refused and the store ends the session.
    vi.stubGlobal("fetch", async () => sessionInvalid());
    await expect(apiClient.get("/todos")).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(queryClient.getQueryData(["passkeys"])).toBeUndefined();
    binding.unmount();
  });
});
