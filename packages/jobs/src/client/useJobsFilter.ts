import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { endOfDay, startOfDay, startOfMonth, subtractDays } from "@groot/shell/lib/utils";
import { JOBS_PAGE_SIZE, STATE_TABS, secondaryOptions, type StateTab } from "./constants";

/** The date ranges the jobs list offers, by the name the URL stores. */
export const JOBS_DATE_PRESETS = ["all", "today", "last-7-days", "this-month"] as const;
export type JobsDatePreset = (typeof JOBS_DATE_PRESETS)[number];

/** Query params of `GET /api/v1/jobs`, as `jobsApi.getJobs()` takes them. */
export interface JobsListParams {
  state?: string;
  name?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}

// The URL schema: `?state=failed&queue=report&search=abc&datePreset=today&page=2`.
// A value at its default is left out of the URL. The date range is stored as
// the preset's name, never as dates, so a shared `?datePreset=today` link
// means today when it is opened.
const urlSchema = {
  state: parseAsStringLiteral(STATE_TABS.map((tab) => tab.value)).withDefault("all"),
  queue: parseAsString.withDefault("all"),
  search: parseAsString.withDefault(""),
  datePreset: parseAsStringLiteral(JOBS_DATE_PRESETS).withDefault("all"),
  page: parseAsInteger.withDefault(0),
};

function presetRange(preset: JobsDatePreset, now: Date): { startDate?: string; endDate?: string } {
  const start =
    preset === "today"
      ? startOfDay(now)
      : preset === "last-7-days"
        ? startOfDay(subtractDays(now, 6))
        : preset === "this-month"
          ? startOfMonth(now)
          : null;
  return start ? { startDate: start.toISOString(), endDate: endOfDay(now).toISOString() } : {};
}

/**
 * The jobs list filter: the one owner of its URL params. Read the current
 * values, change them through the intent setters (each filter change goes
 * back to the first page), map them to the list endpoint's params with
 * `listParams()`, and key anything that must reset with the filter (the row
 * selection) on `filterKey`.
 */
export function useJobsFilter() {
  const [values, setValues] = useQueryStates(urlSchema);
  const { state, queue, search, datePreset: preset } = values;
  const page = Math.max(0, values.page);

  // `null` clears a param back to its default (and out of the URL).
  const refilter = (patch: {
    [K in Exclude<keyof typeof values, "page">]?: (typeof values)[K] | null;
  }) => void setValues({ ...patch, page: null });

  return {
    state,
    queue,
    search,
    preset,
    page,
    /** The selected state when it is one of the overflow-menu states. */
    activeSecondaryTab: secondaryOptions.find((tab) => tab.value === state),
    hasActiveFilters:
      state !== "all" || queue !== "all" || search.trim() !== "" || preset !== "all",
    /** Changes whenever the filter or the page does. */
    filterKey: JSON.stringify([state, queue, search, preset, page]),
    setState: (next: StateTab) => refilter({ state: next }),
    setQueue: (next: string) => refilter({ queue: next }),
    setSearch: (next: string) => refilter({ search: next }),
    setPreset: (next: JobsDatePreset) => refilter({ datePreset: next }),
    goToPage: (next: number) => void setValues({ page: Math.max(0, next) || null }),
    clear: () => refilter({ state: null, queue: null, search: null, datePreset: null }),
    /**
     * The list endpoint's params for this filter. A date preset is resolved
     * against `now` on each call, so call it when the query runs.
     */
    listParams: (now: Date = new Date()): JobsListParams => {
      const query = search.trim();
      return {
        limit: JOBS_PAGE_SIZE,
        offset: page * JOBS_PAGE_SIZE,
        ...(state !== "all" && { state }),
        ...(queue !== "all" && { name: queue }),
        ...(query && { search: query }),
        ...presetRange(preset, now),
      };
    },
  };
}

export type JobsFilter = ReturnType<typeof useJobsFilter>;
