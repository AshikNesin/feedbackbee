import { describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@groot/ui/dialog";
import {
  formatShortcut,
  isEditable,
  matchesShortcut,
  parseShortcut,
  useHotkey,
  type HotkeyOptions,
} from "@groot/ui/hotkeys";

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, code: `Key${key.toUpperCase()}`, ...init });

function bindHotkey(combo: string, options?: HotkeyOptions) {
  const handler = vi.fn();
  const hook = renderHook((props: HotkeyOptions | undefined) => useHotkey(combo, handler, props), {
    initialProps: options,
  });
  return { handler, ...hook };
}

describe("hotkey grammar", () => {
  it("parses, matches and formats one syntax", () => {
    const modK = parseShortcut("mod+k");
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }), modK)).toBe(
      true,
    );
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "k", metaKey: true }), modK)).toBe(
      true,
    );
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "k" }), modK)).toBe(false);
    expect(formatShortcut("mod+,", true)).toEqual(["⌘", ","]);
    expect(formatShortcut("mod+shift+p", false)).toEqual(["Ctrl", "Shift", "P"]);
  });

  it("knows a text field", () => {
    expect(isEditable(document.createElement("input"))).toBe(true);
    expect(isEditable(document.createElement("textarea"))).toBe(true);
    expect(isEditable(document.createElement("select"))).toBe(true);
    expect(isEditable(document.createElement("button"))).toBe(false);
    expect(isEditable(window)).toBe(false);
    expect(isEditable(null)).toBe(false);
  });
});

describe("useHotkey", () => {
  it("runs the handler once per press and claims the event", () => {
    const { handler } = bindHotkey("mod+j");
    const notDefault = press("j", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(notDefault).toBe(false);
    press("j");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores a repeat and a press something already handled", () => {
    const { handler } = bindHotkey("mod+j");
    press("j", { ctrlKey: true, repeat: true });
    const handled = document.createElement("div");
    document.body.append(handled);
    handled.addEventListener("keydown", (e) => e.preventDefault());
    press("j", { ctrlKey: true }, handled);
    handled.remove();
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps a bare key out of text fields unless asked; a modifier combo fires anywhere", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const slash = bindHotkey("/");
    const gInFields = bindHotkey("g", { inFields: true });
    const modJ = bindHotkey("mod+j");

    fireEvent.keyDown(input, { key: "/" });
    press("g", {}, input);
    press("j", { ctrlKey: true }, input);
    expect(slash.handler).not.toHaveBeenCalled();
    expect(gInFields.handler).toHaveBeenCalledTimes(1);
    expect(modJ.handler).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: "/" });
    expect(slash.handler).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it("lets only the most recently bound of two global hotkeys answer", () => {
    const first = bindHotkey("mod+j");
    const second = bindHotkey("mod+j");
    press("j", { ctrlKey: true });
    expect(first.handler).not.toHaveBeenCalled();
    expect(second.handler).toHaveBeenCalledTimes(1);

    second.unmount();
    press("j", { ctrlKey: true });
    expect(first.handler).toHaveBeenCalledTimes(1);
  });

  it("gives a dialog's combo precedence over a global hotkey on the same keys", () => {
    const dialog = bindHotkey("mod+k", { scope: "dialog", open: false });
    const nav = bindHotkey("mod+k");
    press("k", { ctrlKey: true });
    expect(dialog.handler).toHaveBeenCalledTimes(1);
    expect(nav.handler).not.toHaveBeenCalled();
  });

  it("blocks global hotkeys while a dialog's hotkey says it is open, but still closes it", () => {
    const dialog = bindHotkey("mod+k", { scope: "dialog", open: true });
    const nav = bindHotkey("mod+,");
    press(",", { ctrlKey: true, code: "Comma" });
    expect(nav.handler).not.toHaveBeenCalled();
    press("k", { ctrlKey: true });
    expect(dialog.handler).toHaveBeenCalledTimes(1);

    dialog.rerender({ scope: "dialog", open: false });
    press(",", { ctrlKey: true, code: "Comma" });
    expect(nav.handler).toHaveBeenCalledTimes(1);
  });

  it("blocks global hotkeys and other dialogs' combos while any modal dialog is open", () => {
    const nav = bindHotkey("mod+,");
    const palette = bindHotkey("mod+k", { scope: "dialog", open: false });
    const view = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>Queue a job.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    press(",", { ctrlKey: true, code: "Comma" });
    press("k", { ctrlKey: true });
    expect(nav.handler).not.toHaveBeenCalled();
    expect(palette.handler).not.toHaveBeenCalled();

    view.unmount();
    press(",", { ctrlKey: true, code: "Comma" });
    expect(nav.handler).toHaveBeenCalledTimes(1);
  });

  it("answers only while focus is inside `within`", () => {
    const handler = vi.fn();
    function Pane() {
      const ref = useRef<HTMLDivElement>(null);
      useHotkey("mod+j", handler, { within: ref });
      return (
        <div ref={ref}>
          <button type="button">inside</button>
        </div>
      );
    }
    render(
      <>
        <Pane />
        <button type="button">outside</button>
      </>,
    );
    screen.getByRole("button", { name: "outside" }).focus();
    press("j", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "inside" }).focus();
    press("j", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("binds nothing for a null combo or when disabled", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(null, handler));
    const disabled = bindHotkey("mod+j", { enabled: false });
    press("j", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    expect(disabled.handler).not.toHaveBeenCalled();
  });
});
