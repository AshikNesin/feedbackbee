/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import { GrootUIProvider } from "@groot/ui/provider";
import { createShellQueryClient, ShellQueryProvider } from "@groot/shell/lib/query-client";
import { OFFLINE_MESSAGE } from "@groot/shell/lib/feedback";
import { JobActions } from "@groot/jobs/client/components/JobActions";
import type { Job } from "@groot/jobs/client/types";

const FAILED_JOB: Job = {
  id: "bbbbbbbb-2",
  name: "report",
  data: null,
  state: "failed",
  priority: 0,
  retryLimit: 0,
  retryCount: 0,
  retryDelay: 0,
  runAt: "2026-01-01T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  output: null,
  error: null,
  singletonKey: null,
};

function renderActions() {
  return render(
    <ShellQueryProvider client={createShellQueryClient({ queries: { retry: false } })}>
      <GrootUIProvider>
        <MemoryRouter>
          <JobActions job={FAILED_JOB} />
        </MemoryRouter>
      </GrootUIProvider>
    </ShellQueryProvider>,
  );
}

/** Answer the retry call with `respond`. */
function stubRetry(respond: () => Promise<Response>) {
  const fetch = vi.fn((_url: string) => respond());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("job action feedback", () => {
  it("words a bare 502 with the action's fallback, not the status line", async () => {
    const user = userEvent.setup();
    stubRetry(
      async () =>
        new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    renderActions();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Failed to retry job")).toBeInTheDocument();
    expect(screen.queryByText("Bad Gateway")).not.toBeInTheDocument();
  });

  it("words a dropped connection as offline", async () => {
    const user = userEvent.setup();
    stubRetry(() => Promise.reject(new TypeError("Failed to fetch")));
    renderActions();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();
  });

  it("shows the server's own refusal", async () => {
    const user = userEvent.setup();
    stubRetry(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "CONFLICT", message: "Only failed jobs can be retried" },
          }),
          { status: 409 },
        ),
    );
    renderActions();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Only failed jobs can be retried")).toBeInTheDocument();
  });

  it("ignores a second click while the action runs", async () => {
    const user = userEvent.setup();
    let release!: (response: Response) => void;
    const fetch = stubRetry(() => new Promise<Response>((resolve) => (release = resolve)));
    renderActions();

    const retry = screen.getByRole("button", { name: "Retry" });
    await user.click(retry);
    await user.click(retry);
    release(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    expect(await screen.findByText("Job has been queued for retry")).toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/retry"))).toHaveLength(1);
  });
});
