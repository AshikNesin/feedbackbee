/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GrootUIProvider } from "@groot/ui/provider";
import { createShellQueryClient, ShellQueryProvider } from "@groot/shell/lib/query-client";
import { AppSettings } from "@groot/shell/components/AppSettings";
import type { AppSetting } from "@groot/shell/hooks/useAppSettingsData";

// CodeMirror does not run in jsdom; a textarea stands in for the JSON editor.
vi.mock("@groot/shell/components/CodeMirrorEditor", () => ({
  CodeMirrorEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="JSON value" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

type Call = { method: string; path: string };

/** A fake `/api/v1/settings` over `settings`, recording every call. */
function serve(initial: AppSetting[]) {
  const server = { settings: [...initial], calls: [] as Call[] };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const path = url.replace("/api/v1", "");
    const method = init.method ?? "GET";
    server.calls.push({ method, path });
    const ok = (data: unknown, status = 200) =>
      new Response(JSON.stringify({ success: true, data }), { status });
    if (method === "GET" && path === "/settings") return ok(server.settings);
    if (method === "PUT") {
      const key = decodeURIComponent(path.slice("/settings/".length));
      const body = JSON.parse(String(init.body)) as Omit<AppSetting, "key">;
      const setting = { key, ...body } as AppSetting;
      server.settings = [...server.settings.filter((s) => s.key !== key), setting];
      return ok(setting);
    }
    return new Response(null, { status: 404 });
  });
  return server;
}

const THEME: AppSetting = {
  key: "theme",
  value: { mode: "dark" },
  metadata: { description: "UI theme", updatedAt: "2026-01-01T00:00:00.000Z" },
};
const LIMITS: AppSetting = {
  key: "limits",
  value: { max: 10 },
  metadata: { description: "Rate limits", updatedAt: "2026-01-01T00:00:00.000Z" },
};

function renderSettings() {
  return render(
    <ShellQueryProvider client={createShellQueryClient({ queries: { retry: false } })}>
      <GrootUIProvider>
        <AppSettings />
      </GrootUIProvider>
    </ShellQueryProvider>,
  );
}

const writes = (server: { calls: Call[] }) => server.calls.filter((c) => c.method !== "GET");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AppSettings", () => {
  it("shows the action's own wording when the JSON does not parse", async () => {
    const user = userEvent.setup();
    const server = serve([THEME]);
    renderSettings();

    const editor = await screen.findByRole("textbox", { name: "JSON value" });
    await user.clear(editor);
    await user.type(editor, "{{not json");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Invalid JSON format")).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(writes(server)).toEqual([]);
  });

  it("refuses to create a key that exists, without a request", async () => {
    const user = userEvent.setup();
    const server = serve([THEME]);
    renderSettings();

    await user.click(await screen.findByRole("button", { name: /add setting/i }));
    await user.type(screen.getByPlaceholderText(/featureFlags/), "theme");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(await screen.findByText(/A setting named “theme” already exists/)).toBeInTheDocument();
    expect(writes(server)).toEqual([]);
    expect(screen.getByLabelText("Description")).toHaveValue("UI theme");
  });

  it("keeps a dirty draft when a refetch brings a new server value", async () => {
    const user = userEvent.setup();
    const server = serve([THEME]);
    renderSettings();

    const description = await screen.findByLabelText("Description");
    await user.clear(description);
    await user.type(description, "my edit");

    // Someone else saves the setting; the page refetches.
    server.settings = [
      {
        ...THEME,
        value: { mode: "light" },
        metadata: { ...THEME.metadata!, description: "theirs" },
      },
    ];
    const gets = server.calls.length;
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(gets));

    expect(
      await screen.findByText(/saved value changed since you started editing/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("my edit");
    expect(screen.getByRole("textbox", { name: "JSON value" })).toHaveValue(
      JSON.stringify(THEME.value, null, 2),
    );
  });

  it("follows the server while the draft is clean", async () => {
    const user = userEvent.setup();
    const server = serve([THEME]);
    renderSettings();
    expect(await screen.findByLabelText("Description")).toHaveValue("UI theme");

    server.settings = [{ ...THEME, metadata: { ...THEME.metadata!, description: "renamed" } }];
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(screen.getByLabelText("Description")).toHaveValue("renamed"));
  });

  it("asks before switching away from unsaved edits", async () => {
    const user = userEvent.setup();
    serve([THEME, LIMITS]);
    renderSettings();

    const description = await screen.findByLabelText("Description");
    await user.type(description, " (edited)");
    await user.click(screen.getByRole("button", { name: /limits/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Discard unsaved changes?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Description")).toHaveValue("UI theme (edited)");

    await user.click(screen.getByRole("button", { name: /limits/ }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => expect(screen.getByLabelText("Description")).toHaveValue("Rate limits"));
  });

  it("saves the draft and is clean again once the server has it", async () => {
    const user = userEvent.setup();
    const server = serve([THEME]);
    renderSettings();

    const description = await screen.findByLabelText("Description");
    await user.clear(description);
    await user.type(description, "Theme settings");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(`"theme" updated successfully`)).toBeInTheDocument();
    expect(writes(server)).toEqual([{ method: "PUT", path: "/settings/theme" }]);
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Description")).toHaveValue("Theme settings");
  });
});
