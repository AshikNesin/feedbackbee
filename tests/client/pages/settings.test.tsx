/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CheckSquare, Settings as SettingsIcon } from "lucide-react";
import { GrootUIProvider } from "@groot/ui/provider";
import { type ShellConfig, ShellProvider } from "@groot/shell/lib/shell-config";
import { createShellQueryClient, ShellQueryProvider } from "@groot/shell/lib/query-client";
import { Layout } from "@groot/shell/components/Layout";
import { Settings } from "@groot/shell/pages/settings/Settings";
import { useAuthStore } from "@groot/shell/store/auth";
import { useCommandPaletteStore } from "@groot/shell/store/command-palette";

const CONFIG: ShellConfig = {
  brand: { label: "Acme" },
  nav: [
    { label: "Todos", icon: CheckSquare, to: "/todos", primary: true },
    { label: "Settings", icon: SettingsIcon, to: "/settings", fullPage: true },
  ],
};

function Pathname() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  // Security and Configuration query the API; with no server they settle into their error states.
  const queryClient = createShellQueryClient({ queries: { retry: false } });
  return render(
    <ShellQueryProvider client={queryClient}>
      <GrootUIProvider>
        <MemoryRouter initialEntries={[path]}>
          <ShellProvider config={CONFIG}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route path="todos" element={<p>todos page</p>} />
                <Route path="settings/*" element={<Settings />} />
              </Route>
            </Routes>
            <Pathname />
          </ShellProvider>
        </MemoryRouter>
      </GrootUIProvider>
    </ShellQueryProvider>,
  );
}

const pathname = () => screen.getByTestId("pathname").textContent;
const heading = () => screen.getByRole("heading", { level: 1 });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 7, email: "demo@example.com", name: "Demo User" } });
});

afterEach(() => {
  useCommandPaletteStore.setState({ open: false });
  useAuthStore.setState({ user: null });
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("Settings page", () => {
  it("redirects the bare path and unknown sections to Account", () => {
    renderAt("/settings");
    expect(pathname()).toBe("/settings/account");
    expect(heading()).toHaveTextContent("Account");
    expect(screen.getAllByText("demo@example.com").length).toBeGreaterThan(0);
  });

  it("redirects an unknown section to the first one", () => {
    renderAt("/settings/nope");
    expect(pathname()).toBe("/settings/account");
  });

  it("renders full page: no app sidebar, a link back to the app", () => {
    renderAt("/settings/account");
    expect(screen.queryByRole("link", { name: "Todos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to acme/i })).toHaveAttribute("href", "/");
  });

  it("keeps the app sidebar on other pages", () => {
    renderAt("/todos");
    expect(screen.getAllByRole("link", { name: "Todos" }).length).toBeGreaterThan(0);
  });

  it("navigates between sections from the sidebar", async () => {
    const user = userEvent.setup();
    renderAt("/settings/account");
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(within(nav).getByRole("link", { name: "Account" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(within(nav).getByRole("link", { name: "Appearance" }));
    expect(pathname()).toBe("/settings/appearance");
    expect(heading()).toHaveTextContent("Appearance");
    expect(within(nav).getByRole("link", { name: "Appearance" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("finds a section by keyword and opens it with Enter", async () => {
    const user = userEvent.setup();
    renderAt("/settings/account");
    const search = screen.getByRole("combobox", { name: "Search settings" });

    await user.type(search, "dark");
    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveTextContent("Appearance");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(within(list).getByRole("option", { name: /theme/i })).toHaveTextContent(
      "Personal › Appearance",
    );

    await user.keyboard("{Enter}");
    expect(pathname()).toBe("/settings/appearance");
    expect(search).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves the highlight with the arrow keys and opens a result on click", async () => {
    const user = userEvent.setup();
    renderAt("/settings/account");
    const search = screen.getByRole("combobox", { name: "Search settings" });

    await user.type(search, "passkey");
    await user.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(search).toHaveAttribute("aria-activedescendant", options[1]!.id);

    await user.click(screen.getByRole("option", { name: /add a passkey/i }));
    expect(pathname()).toBe("/settings/security");
    expect(heading()).toHaveTextContent("Security");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderAt("/settings/account");
    await user.type(screen.getByRole("combobox", { name: "Search settings" }), "zzz");
    expect(screen.getByText("No matching settings")).toBeInTheDocument();
  });

  it("focuses the search on / and clears it on Escape", async () => {
    const user = userEvent.setup();
    renderAt("/settings/account");
    const search = screen.getByRole("combobox", { name: "Search settings" });

    await user.keyboard("/");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");

    await user.keyboard("theme");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(search).not.toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
