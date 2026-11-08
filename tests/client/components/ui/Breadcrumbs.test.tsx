import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vite-plus/test";
import { Breadcrumbs } from "@groot/ui/breadcrumb";

describe("Breadcrumbs", () => {
  it("renders one flat list: items, separators between them, the page current", () => {
    const { container } = render(
      <Breadcrumbs page="echo">
        <a href="/connections">Connections</a>
        <a href="/connections/c1">Weather</a>
      </Breadcrumbs>,
    );

    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(container.querySelectorAll("nav")).toHaveLength(1);
    expect(nav.querySelectorAll("ol")).toHaveLength(1);
    const items = within(nav).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Connections", "Weather", "echo"]);
    expect(nav.querySelectorAll('li[role="presentation"]')).toHaveLength(2);
    expect(nav.querySelectorAll("li li")).toHaveLength(0);
    expect(within(items[2]).getByText("echo")).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Weather" })).toHaveAttribute(
      "href",
      "/connections/c1",
    );
  });

  it("without a page, the last link ends the trail with no trailing separator", () => {
    render(
      <Breadcrumbs>
        <button type="button" aria-label="Go to root folder" />
      </Breadcrumbs>,
    );

    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(1);
    expect(nav.querySelectorAll('li[role="presentation"]')).toHaveLength(0);
    expect(nav.querySelector("[aria-current]")).toBeNull();
  });

  it("treats page={false} as no page: no empty current crumb, no trailing separator", () => {
    const hasPage = false;
    render(
      <Breadcrumbs page={hasPage && "never"}>
        <a href="/jobs">Jobs</a>
      </Breadcrumbs>,
    );

    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(1);
    expect(nav.querySelectorAll('li[role="presentation"]')).toHaveLength(0);
    expect(nav.querySelector("[aria-current]")).toBeNull();
  });

  it("flattens fragment children into one crumb per link", () => {
    const { container } = render(
      <Breadcrumbs page="inner">
        <a href="/">Root</a>
        <>
          <a href="/a">A</a>
          <a href="/a/b">B</a>
        </>
      </Breadcrumbs>,
    );

    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    const items = within(nav).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Root", "A", "B", "inner"]);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/", "/a", "/a/b"]);
    expect(nav.querySelectorAll('li[role="presentation"]')).toHaveLength(3);
    expect(container.querySelectorAll("li li")).toHaveLength(0);
  });
});
