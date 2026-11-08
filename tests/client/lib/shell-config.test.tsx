/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Box, CheckSquare, HardDrive, Settings as SettingsIcon, Star } from "lucide-react";
import { type ShellConfig, ShellProvider } from "@groot/shell/lib/shell-config";
import { Layout } from "@groot/shell/components/Layout";
import { Login } from "@groot/shell/pages/auth/Login";
import { useAuthStore } from "@groot/shell/store/auth";
import { useCommandPaletteStore } from "@groot/shell/store/command-palette";

const CONFIG: ShellConfig = {
  brand: { label: "Acme" },
  nav: [
    { label: "Todos", icon: CheckSquare, to: "/todos", primary: true },
    { label: "Storage", icon: HardDrive, to: "/storage" },
    { label: "Settings", icon: SettingsIcon, to: "/settings", shortcut: "mod+," },
  ],
};

function renderLayout(config: ShellConfig, props: Parameters<typeof Layout>[0] = {}) {
  useAuthStore.setState({ user: { id: 1, email: "demo@example.com", name: "Demo User" } });
  return render(
    <MemoryRouter initialEntries={["/todos"]}>
      <ShellProvider config={config}>
        <Routes>
          <Route path="/" element={<Layout {...props} />}>
            <Route path="todos" element={<p>todos page</p>} />
            <Route path="settings" element={<p>settings page</p>} />
          </Route>
        </Routes>
      </ShellProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useCommandPaletteStore.setState({ open: false });
  useAuthStore.setState({ user: null });
});

describe("ShellConfig", () => {
  it("overrides Login brand and marketing copy", () => {
    render(
      <MemoryRouter>
        <ShellProvider
          config={{
            brand: { label: "Acme" },
            login: {
              tagline: "Ship smarter.",
              features: [{ icon: Box, title: "Custom feature", desc: "Custom description" }],
            },
          }}
        >
          <Login />
        </ShellProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Ship smarter.")).toBeInTheDocument();
    expect(screen.getByText("Custom feature")).toBeInTheDocument();
  });

  it("keeps the Groot Login defaults without a provider", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText("Groot")).toBeInTheDocument();
  });

  it("puts primary destinations in the sidebar", () => {
    renderLayout(CONFIG);
    const todos = screen.getAllByRole("link", { name: "Todos" });
    expect(todos.length).toBeGreaterThan(0);
    for (const link of todos) expect(link).toHaveAttribute("href", "/todos");
    expect(screen.queryByRole("link", { name: "Storage" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Acme").length).toBeGreaterThan(0);
  });

  it("lays the account menu out like Amp: Log out first, then the palette, then the other destinations", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderLayout(CONFIG);
    await user.click(screen.getAllByRole("button", { name: /demo user/i })[0]!);
    const menu = await screen.findByRole("menu");
    const rows = within(menu)
      .getAllByRole("menuitem")
      .map((row) => row.textContent);
    // jsdom is not a Mac, so the hints spell Ctrl rather than ⌘.
    expect(rows).toEqual(["Log out", "Command paletteCtrl K", "Storage", "SettingsCtrl ,"]);
    expect(within(menu).queryByRole("menuitem", { name: "Theme" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Log out" })).not.toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  it("opens the command palette from the account menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderLayout(CONFIG);
    await user.click(screen.getAllByRole("button", { name: /demo user/i })[0]!);
    await user.click(await screen.findByRole("menuitem", { name: "Command palette" }));
    expect(useCommandPaletteStore.getState().open).toBe(true);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    ["⌘,", "{Meta>},{/Meta}"],
    ["Ctrl+,", "{Control>},{/Control}"],
  ])("binds a destination's shortcut (%s goes to Settings)", async (_label, keys) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderLayout(CONFIG);
    expect(screen.getByText("todos page")).toBeInTheDocument();
    await user.keyboard(keys);
    expect(await screen.findByText("settings page")).toBeInTheDocument();
  });

  it("shows a destination's shortcut in ⌘K too", () => {
    useCommandPaletteStore.setState({ open: true });
    renderLayout(CONFIG);
    const settings = within(screen.getByRole("dialog")).getByRole("option", { name: /Settings/ });
    expect(settings).toHaveTextContent("Ctrl,");
  });
  it("lists every destination in ⌘K, and keeps Theme and Log out next to app groups", () => {
    useCommandPaletteStore.setState({ open: true });
    renderLayout(CONFIG, {
      commandGroups: [
        { heading: "Actions", items: [{ label: "Star", icon: Star, onSelect() {} }] },
      ],
    });
    const palette = screen.getByRole("dialog");
    for (const name of ["Todos", "Storage", "Settings", "Star", "Dark theme", "Log out"]) {
      // A row's accessible name ends with its shortcut caps, if any.
      expect(
        within(palette).getByRole("option", { name: new RegExp(`^${name}`) }),
      ).toBeInTheDocument();
    }
  });

  it("keeps log out and the palette in the account menu when the app has no destinations", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderLayout({});
    await user.click(screen.getAllByRole("button", { name: /demo user/i })[0]!);
    expect(await screen.findByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Command palette" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });
});
