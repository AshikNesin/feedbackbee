/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vite-plus/test";
import type { GithubRepositoryDTO } from "../../../apps/web/src/server/wire-types";
import { GithubRepositorySelect } from "../../../apps/web/src/client/features/github/GithubRepositorySelect";

const mocks = vi.hoisted(() => ({ useRepositories: vi.fn() }));

vi.mock("../../../apps/web/src/client/features/github/useGithub", () => ({
  useGithubRepositories: mocks.useRepositories,
}));

const repositories: GithubRepositoryDTO[] = [
  { id: 1, fullName: "acme/current", installationId: 5 },
];

describe("GitHub repository selection", () => {
  it("keeps an inaccessible current repo visible without replacing it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    mocks.useRepositories.mockReturnValue({
      data: repositories,
      isPending: false,
      isError: false,
    });

    render(<GithubRepositorySelect id="repo" value="legacy/private" onChange={onChange} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("legacy/private (not accessible)");
    expect(
      screen.getByText(/not accessible through the current GitHub App installation/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    expect(
      await screen.findByRole("option", { name: "legacy/private (not accessible)" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "acme/current" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
