import { afterEach, describe, expect, it } from "vite-plus/test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { GrootUIProvider } from "@groot/ui/provider";
import { ShellProvider } from "@groot/shell/lib/shell-config";
import {
  CommandPaletteDialog,
  type CommandGroupEntry,
} from "@groot/shell/components/CommandPalette";
import { useCommandPaletteStore } from "@groot/shell/store/command-palette";

const noop = () => undefined;

// Two groups share the heading "Recent" but not the id.
const GROUPS: CommandGroupEntry[] = [
  { id: "recent-todos", heading: "Recent", items: [{ label: "Buy milk", onSelect: noop }] },
  { id: "recent-jobs", heading: "Recent", items: [{ label: "report job", onSelect: noop }] },
  { heading: "Tools", items: [{ label: "Clear cache", onSelect: noop }] },
];

function renderPalette() {
  useCommandPaletteStore.setState({ open: true });
  return render(
    <GrootUIProvider>
      <MemoryRouter>
        <ShellProvider config={{}}>
          <CommandPaletteDialog groups={GROUPS} builtIns={false} />
        </ShellProvider>
      </MemoryRouter>
    </GrootUIProvider>,
  );
}

const options = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);

afterEach(() => useCommandPaletteStore.setState({ open: false }));

describe("CommandPaletteDialog", () => {
  it("filters a tab by its group's id, not its heading", async () => {
    const user = userEvent.setup();
    renderPalette();
    const tabs = within(await screen.findByRole("tablist")).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[1]).toHaveTextContent("Recent");
    expect(tabs[2]).toHaveTextContent("Recent");
    expect(options()).toHaveLength(3);

    await user.click(tabs[1]!);
    expect(options()).toEqual([expect.stringContaining("Buy milk")]);

    await user.click(tabs[2]!);
    expect(options()).toEqual([expect.stringContaining("report job")]);

    await user.click(tabs[3]!);
    expect(options()).toEqual([expect.stringContaining("Clear cache")]);
  });
});
