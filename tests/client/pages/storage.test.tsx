/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router-dom";
import { GrootUIProvider } from "@groot/ui/provider";
import { createShellQueryClient, ShellQueryProvider } from "@groot/shell/lib/query-client";
import { Storage } from "@groot/shell/pages/storage/Storage";
import type { StorageFile as FileInfo } from "@groot/shell/pages/storage/hooks/useStorage";
import { FIXED_NOW } from "../../test-clock";

/** The fake server's objects: key → bytes. Folders are key prefixes, as on an object store. */
let objects: Map<string, string>;
/** Every request the page sent, as "METHOD path". */
let requests: string[];

function listing(folder: string): FileInfo[] {
  const folders = new Set<string>();
  const files: FileInfo[] = [];
  for (const [key, body] of objects) {
    if (!key.startsWith(folder)) continue;
    const rest = key.slice(folder.length);
    const slash = rest.indexOf("/");
    if (slash >= 0) folders.add(rest.slice(0, slash));
    else {
      files.push({
        key,
        name: rest,
        size: body.length,
        lastModified: new Date(FIXED_NOW).toISOString(),
        isDirectory: false,
      });
    }
  }
  const dirs = [...folders].sort().map((name) => ({
    key: `${folder}${name}/`,
    name,
    size: 0,
    lastModified: new Date(0).toISOString(),
    isDirectory: true,
  }));
  return [...dirs, ...files.sort((a, b) => a.name.localeCompare(b.name))];
}

const json = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = init.method ?? "GET";
  const path = url.pathname.replace(/^\/api\/v1/, "");
  requests.push(`${method} ${path}`);
  if (method === "GET" && path === "/storage/files") {
    return json(listing(url.searchParams.get("folder") ?? ""));
  }
  if (method === "DELETE" && path === "/storage/files") {
    const { filePaths } = JSON.parse(String(init.body)) as { filePaths: string[] };
    for (const key of filePaths) objects.delete(key);
    return new Response(null, { status: 204 });
  }
  return new Response("not found", { status: 404 });
}

function renderStorage(search = "") {
  const client = createShellQueryClient({ queries: { retry: false } });
  // `searchParams` stands in for the URL: re-rendering with another value is
  // a navigation from outside the page (the sidebar or ⌘K "Storage" link
  // resets `?path` while the page stays mounted).
  const tree = (searchParams: string) => (
    <ShellQueryProvider client={client}>
      <GrootUIProvider>
        {/* Shell pages render inside the app's router; a PageLayout may navigate. */}
        <MemoryRouter>
          <NuqsTestingAdapter searchParams={searchParams} hasMemory>
            <Storage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </GrootUIProvider>
    </ShellQueryProvider>
  );
  const view = render(tree(search));
  return { navigate: (searchParams: string) => view.rerender(tree(searchParams)) };
}

/** The desktop table row of `name`. */
const rowOf = (name: string) =>
  screen.getAllByRole("row").find((row) => within(row).queryByText(name, { exact: true }))!;

/** The mobile card (list item) of `name`. */
const cardOf = (name: string) =>
  within(screen.getByRole("list", { name: "Files" }))
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name, { exact: true }))!;

const buttonNames = (element: HTMLElement) =>
  within(element)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent)
    .filter((name) => name !== "a.txt" && name !== "docs"); // the name cell's own button

async function select(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(rowOf(name)).getByRole("checkbox", { name: `Select ${name}` }));
}

beforeEach(() => {
  objects = new Map([
    ["a/one.txt", "1"],
    ["a/two.txt", "22"],
    ["a/three.txt", "333"],
    ["root.txt", "r"],
  ]);
  requests = [];
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Storage browser", () => {
  it("drops a selection made in another folder, so a path change can never delete it", async () => {
    const user = userEvent.setup();
    const { navigate } = renderStorage("?path=a/");
    await screen.findByText("one.txt", { selector: "td *" });

    await select(user, "one.txt");
    await select(user, "two.txt");
    expect(screen.getByRole("button", { name: "Clear (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    navigate("");
    await screen.findByText("root.txt", { selector: "td *" });

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clear/ })).not.toBeInTheDocument();
    // Coming back does not revive the old picks either.
    await user.click(within(rowOf("a")).getByRole("button", { name: "a" }));
    await screen.findByText("one.txt", { selector: "td *" });
    expect(screen.queryByRole("button", { name: /^Clear/ })).not.toBeInTheDocument();

    expect(requests.filter((r) => r.startsWith("DELETE"))).toEqual([]);
    expect(objects.size).toBe(4);
  });

  it("drops a deleted file from the selection", async () => {
    const user = userEvent.setup();
    renderStorage("?path=a/");
    await screen.findByText("one.txt", { selector: "td *" });

    await select(user, "one.txt");
    await select(user, "two.txt");
    expect(screen.getByRole("button", { name: "Clear (2)" })).toBeInTheDocument();

    await user.click(within(rowOf("one.txt")).getByRole("button", { name: "Delete one.txt" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => expect(screen.queryByText("one.txt", { selector: "td *" })).toBeNull());
    expect(screen.getByRole("button", { name: "Clear (1)" })).toBeInTheDocument();
    expect(requests).toContain("DELETE /storage/files");
    expect(objects.has("a/one.txt")).toBe(false);
    expect(objects.has("a/two.txt")).toBe(true);
  });

  it("deletes the selection after confirming, and only it", async () => {
    const user = userEvent.setup();
    renderStorage("?path=a/");
    await screen.findByText("one.txt", { selector: "td *" });

    await select(user, "one.txt");
    await select(user, "three.txt");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete 2 files?");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /^Clear/ })).toBeNull());
    expect([...objects.keys()].sort()).toEqual(["a/two.txt", "root.txt"]);
  });

  it("gives the mobile card and the desktop row the same actions", async () => {
    objects.set("docs/.keep", "");
    objects.set("a.txt", "x");
    renderStorage();
    await screen.findByText("a.txt", { selector: "td *" });

    for (const name of ["a.txt", "docs"]) {
      const desktop = buttonNames(rowOf(name));
      expect(desktop.length).toBeGreaterThan(0);
      expect(buttonNames(cardOf(name))).toEqual(desktop);
    }
    expect(buttonNames(rowOf("a.txt"))).toEqual([
      "View a.txt",
      "Download a.txt",
      "Rename a.txt",
      "Delete a.txt",
    ]);
    expect(buttonNames(rowOf("docs"))).toEqual(["Delete folder docs"]);
  });

  it("asks before deleting a single file, and keeps it when cancelled", async () => {
    const user = userEvent.setup();
    renderStorage();
    await screen.findByText("root.txt", { selector: "td *" });

    await user.click(within(rowOf("root.txt")).getByRole("button", { name: "Delete root.txt" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Delete "root.txt"?');
    expect(requests.filter((r) => r.startsWith("DELETE"))).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(requests.filter((r) => r.startsWith("DELETE"))).toEqual([]);
    expect(objects.has("root.txt")).toBe(true);
  });
});
