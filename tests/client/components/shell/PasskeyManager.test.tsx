/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { startRegistration } from "@simplewebauthn/browser";
import { GrootUIProvider } from "@groot/ui/provider";
import { createShellQueryClient, ShellQueryProvider } from "@groot/shell/lib/query-client";
import { WEBAUTHN_MESSAGES } from "@groot/shell/lib/feedback";
import { PasskeyManager } from "@groot/shell/components/PasskeyManager";

vi.mock("@simplewebauthn/browser", () => ({ startRegistration: vi.fn() }));

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200 });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/v1", "");
    if (path === "/passkey/list") return ok([]);
    if (path === "/passkey/register/options") return ok({ challenge: "c" });
    return new Response(null, { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PasskeyManager feedback", () => {
  it("words a cancelled passkey prompt from the shell's table", async () => {
    // How @simplewebauthn/browser rethrows the browser's NotAllowedError.
    vi.mocked(startRegistration).mockRejectedValue(
      Object.assign(new Error("The operation either timed out or was not allowed."), {
        name: "NotAllowedError",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      }),
    );
    const user = userEvent.setup();
    render(
      <ShellQueryProvider client={createShellQueryClient({ queries: { retry: false } })}>
        <GrootUIProvider>
          <PasskeyManager />
        </GrootUIProvider>
      </ShellQueryProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /add passkey/i }));
    expect(await screen.findByText(WEBAUTHN_MESSAGES.NotAllowedError!)).toBeInTheDocument();
    expect(screen.getByText("Add failed")).toBeInTheDocument();
    expect(screen.queryByText("Unable to add passkey")).not.toBeInTheDocument();
  });
});
