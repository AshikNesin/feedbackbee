import { describe, expect, it, vi } from "vite-plus/test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { JOBS_PAGE_SIZE } from "@groot/jobs/client/constants";
import { useJobsFilter, type JobsFilter } from "@groot/jobs/client/useJobsFilter";
import { FIXED_NOW } from "../../../test-clock";

function renderFilter(searchParams = "") {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const hook = renderHook(() => useJobsFilter(), {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
  });
  // nuqs writes the URL after the state update, so wait for it.
  const urlBecomes = (queryString: string) =>
    waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(queryString));
  return { ...hook, urlBecomes };
}

const localDay = (iso: string, hours: [number, number, number, number]) => {
  const date = new Date(iso);
  date.setHours(...hours);
  return date;
};

describe("useJobsFilter", () => {
  it("reads its defaults and the URL", () => {
    expect(renderFilter().result.current).toMatchObject({
      state: "all",
      queue: "all",
      search: "",
      preset: "all",
      page: 0,
      hasActiveFilters: false,
    });
    expect(
      renderFilter("?state=failed&queue=report&search=abc&datePreset=today&page=2").result.current,
    ).toMatchObject({
      state: "failed",
      queue: "report",
      search: "abc",
      preset: "today",
      page: 2,
      hasActiveFilters: true,
    });
  });

  it("falls back to the default for an unknown state or preset", () => {
    const { result } = renderFilter("?state=bogus&datePreset=yesterday");
    expect(result.current.state).toBe("all");
    expect(result.current.preset).toBe("all");
  });

  it.each<[string, (filter: JobsFilter) => void, string]>([
    ["setState", (f) => f.setState("failed"), "state=failed"],
    ["setQueue", (f) => f.setQueue("report"), "queue=report"],
    ["setSearch", (f) => f.setSearch("abc"), "search=abc"],
    ["setPreset", (f) => f.setPreset("last-7-days"), "datePreset=last-7-days"],
  ])("%s goes back to the first page", async (_name, change, param) => {
    const { result, urlBecomes } = renderFilter("?page=3");
    expect(result.current.page).toBe(3);
    act(() => change(result.current));
    expect(result.current.page).toBe(0);
    await urlBecomes(`?${param}`);
  });

  it("clear resets every filter and the page", async () => {
    const { result, urlBecomes } = renderFilter(
      "?state=failed&queue=report&search=abc&datePreset=today&page=2",
    );
    act(() => result.current.clear());
    expect(result.current).toMatchObject({
      state: "all",
      queue: "all",
      search: "",
      preset: "all",
      page: 0,
      hasActiveFilters: false,
    });
    await urlBecomes("");
  });

  it("goToPage keeps the filter and never goes below the first page", async () => {
    const { result, urlBecomes } = renderFilter("?state=failed");
    act(() => result.current.goToPage(2));
    expect(result.current.page).toBe(2);
    await urlBecomes("?state=failed&page=2");
    act(() => result.current.goToPage(-1));
    expect(result.current.page).toBe(0);
    await urlBecomes("?state=failed");
  });

  it("changes filterKey with the filter and the page", () => {
    const { result } = renderFilter();
    const keys = new Set([result.current.filterKey]);
    act(() => result.current.setState("failed"));
    keys.add(result.current.filterKey);
    act(() => result.current.setSearch("abc"));
    keys.add(result.current.filterKey);
    act(() => result.current.goToPage(1));
    keys.add(result.current.filterKey);
    expect(keys.size).toBe(4);

    const before = result.current.filterKey;
    act(() => result.current.goToPage(1));
    expect(result.current.filterKey).toBe(before);
  });

  it("maps the filter to the list endpoint's params", () => {
    const { result } = renderFilter("?state=failed&queue=report&search=%20abc%20&page=2");
    expect(result.current.listParams()).toEqual({
      state: "failed",
      name: "report",
      search: "abc",
      limit: JOBS_PAGE_SIZE,
      offset: 2 * JOBS_PAGE_SIZE,
    });
    expect(renderFilter().result.current.listParams()).toEqual({
      limit: JOBS_PAGE_SIZE,
      offset: 0,
    });
  });

  // Expected starts are built from FIXED_NOW in local time, independently of
  // the date helpers the hook uses.
  const now = new Date(FIXED_NOW);
  it.each([
    ["today", new Date(now.getFullYear(), now.getMonth(), now.getDate())],
    ["last-7-days", new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)],
    ["this-month", new Date(now.getFullYear(), now.getMonth(), 1)],
  ] as const)("resolves the %s preset against the clock when asked", (preset, start) => {
    const { result } = renderFilter(`?datePreset=${preset}`);
    expect(result.current.listParams()).toMatchObject({
      startDate: start.toISOString(),
      endDate: localDay(FIXED_NOW, [23, 59, 59, 999]).toISOString(),
    });
  });

  it("stores the preset's name, not dates, so a shared link stays current", async () => {
    const { result, urlBecomes } = renderFilter();
    act(() => result.current.setPreset("today"));
    await urlBecomes("?datePreset=today");
    // Opened a day later, the same link means that day.
    const nextDay = new Date(Date.parse(FIXED_NOW) + 86_400_000);
    expect(result.current.listParams(nextDay).startDate).toBe(
      localDay(nextDay.toISOString(), [0, 0, 0, 0]).toISOString(),
    );
  });
});
