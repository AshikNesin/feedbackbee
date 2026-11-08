import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CheckSquare, Settings as SettingsIcon } from "lucide-react";
import { GrootUIProvider } from "@groot/ui/provider";
import { type ShellConfig, ShellProvider } from "@groot/shell/lib/shell-config";
import { Layout } from "@groot/shell/components/Layout";
import { useAuthStore } from "@groot/shell/store/auth";
import { useCommandPaletteStore } from "@groot/shell/store/command-palette";

const CONFIG: ShellConfig = {
  brand: { label: "Acme" },
  nav: [
    { label: "Todos", icon: CheckSquare, to: "/todos", primary: true },
    { label: "Settings", icon: SettingsIcon, to: "/settings", shortcut: "mod+," },
  ],
};

function Pathname() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <GrootUIProvider>
      <MemoryRouter initialEntries={[path]}>
        <ShellProvider config={CONFIG}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="todos" element={<input aria-label="Todo title" />} />
              <Route path="settings" element={<p>settings page</p>} />
            </Route>
          </Routes>
          <Pathname />
        </ShellProvider>
      </MemoryRouter>
    </GrootUIProvider>,
  );
}

const pathname = () => screen.getByTestId("pathname").textContent;

beforeEach(() => {
  useAuthStore.setState({ user: { id: 7, email: "demo@example.com", name: "Demo User" } });
});

afterEach(() => {
  useCommandPaletteStore.setState({ open: false });
  useAuthStore.setState({ user: null });
  localStorage.clear();
});

describe("Layout nav shortcuts", () => {
  it("navigates on a destination's shortcut, from a text field too", async () => {
    const user = userEvent.setup();
    renderAt("/todos");
    await user.click(screen.getByRole("textbox", { name: "Todo title" }));
    await user.keyboard("{Control>},{/Control}");
    expect(pathname()).toBe("/settings");
  });

  it("does nothing behind the open ⌘K palette", async () => {
    const user = userEvent.setup();
    renderAt("/todos");
    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(useCommandPaletteStore.getState().open).toBe(true);

    await user.keyboard("{Control>},{/Control}");
    expect(pathname()).toBe("/todos");
    expect(useCommandPaletteStore.getState().open).toBe(true);

    // ⌘K again closes the palette; the shortcut works once it is gone.
    await user.keyboard("{Control>}k{/Control}");
    expect(useCommandPaletteStore.getState().open).toBe(false);
    await user.keyboard("{Control>},{/Control}");
    expect(pathname()).toBe("/settings");
  });
});
