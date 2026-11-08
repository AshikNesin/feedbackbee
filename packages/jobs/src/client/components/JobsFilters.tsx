import { Badge } from "@groot/ui/badge";
import { Button } from "@groot/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@groot/ui/dropdown-menu";
import { Input } from "@groot/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@groot/ui/tabs";
import { primaryOptions, secondaryOptions, STATE_TABS } from "@groot/jobs/client/constants";
import { useAvailableJobs } from "@groot/jobs/client/queries";
import type { JobsDatePreset, JobsFilter } from "@groot/jobs/client/useJobsFilter";
import { useState } from "react";
import { Calendar as CalendarIcon, Filter, MoreHorizontal, Search, X } from "lucide-react";

const DATE_PRESETS: { value: JobsDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "this-month", label: "This Month" },
  { value: "all", label: "All Time" },
];

type Props = {
  /** The jobs list filter (`useJobsFilter()`). */
  filter: JobsFilter;
};

/** State tabs + search + queue + date-preset filters for the jobs list. */
export function JobsFilters({ filter }: Props) {
  const { activeSecondaryTab } = filter;
  const availableJobs = useAvailableJobs();
  const [queueSearch, setQueueSearch] = useState("");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs
        value={filter.state}
        onValueChange={(value) => {
          const tab = STATE_TABS.find((t) => t.value === value);
          if (tab) filter.setState(tab.value);
        }}
      >
        {/* These tabs filter one list (there are no tab panels to control),
            and the overflow menu sits beside the tab list, not inside it:
            a tablist may only hold tabs. */}
        <div className="bg-muted inline-flex h-9 items-center rounded-xl p-[3px]">
          <TabsList className="h-full bg-transparent p-0">
            {primaryOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} aria-controls={undefined}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={
                  activeSecondaryTab ? `State: ${activeSecondaryTab.label}` : "More job states"
                }
                className={`inline-flex h-[calc(100%-1px)] items-center justify-center whitespace-nowrap rounded-lg border border-transparent px-1.5 py-0.5 text-sm font-medium focus-visible:outline-none ${
                  activeSecondaryTab
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                    : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                }`}
              >
                {activeSecondaryTab ? (
                  <span className="max-w-[5rem] truncate">{activeSecondaryTab.label}</span>
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {secondaryOptions.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => filter.setState(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Tabs>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-40 lg:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filter.search}
            onChange={(e) => filter.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {availableJobs.length > 0 && (
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) setQueueSearch("");
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="size-4" />
                <span className="hidden md:inline max-w-[6rem] truncate">
                  {filter.queue !== "all" ? filter.queue : "Queue"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 pt-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search queues..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    className="pl-7 h-8 border-0 bg-transparent focus-visible:ring-0"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-[200px] overflow-y-auto">
                <DropdownMenuItem onSelect={() => filter.setQueue("all")}>
                  All Queues
                </DropdownMenuItem>
                {availableJobs.map((jobName) =>
                  jobName.toLowerCase().includes(queueSearch.toLowerCase()) ? (
                    <DropdownMenuItem key={jobName} onSelect={() => filter.setQueue(jobName)}>
                      {jobName}
                    </DropdownMenuItem>
                  ) : null,
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="size-4" />
              <span className="hidden md:inline">
                {filter.preset !== "all"
                  ? DATE_PRESETS.find((p) => p.value === filter.preset)?.label
                  : "Date"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {DATE_PRESETS.map(({ value, label }) => (
              <DropdownMenuItem key={value} onSelect={() => filter.setPreset(value)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filter.queue !== "all" && (
          <Badge variant="secondary" className="h-9 gap-1 px-3 whitespace-nowrap">
            {filter.queue}
            <X className="size-3 cursor-pointer" onClick={() => filter.setQueue("all")} />
          </Badge>
        )}
        {filter.hasActiveFilters && (
          <Button variant="ghost" onClick={filter.clear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
