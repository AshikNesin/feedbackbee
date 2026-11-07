/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import type { GithubRepositoryDTO, GithubSettingsDTO } from "../../../server/wire-types";
import { GithubSettings } from "./GithubSettings";

const mocks = vi.hoisted(() => ({
  useSettings: vi.fn(),
  useRepositories: vi.fn(),
  post: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("./useGithub", () => ({
  useGithubSettings: mocks.useSettings,
  useGithubRepositories: mocks.useRepositories,
  githubSettingsKey: ["github", "settings"],
  githubRepositoriesKey: ["github", "repositories"],
}));
vi.mock("@groot/shell/lib/api", () => ({ apiClient: { post: mocks.post } }));
vi.mock("@groot/ui/primitives", () => ({ useConfirm: () => mocks.confirm }));

const repository: GithubRepositoryDTO = {
  id: 42,
  fullName: "acme/feedback",
  installationId: 7,
};

function renderSettings(path = "/app/settings") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <GithubSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setSettings(data: GithubSettingsDTO) {
  mocks.useSettings.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
}

function setRepositories(data: GithubRepositoryDTO[]) {
  mocks.useRepositories.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setSettings({
    encryptionConfigured: true,
    app: null,
    repositories: [],
    connectionError: null,
  });
  setRepositories([]);
  mocks.post.mockResolvedValue({
    url: "https://github.com/apps/new",
    manifest: { name: "FeedbackBee" },
  });
  mocks.confirm.mockResolvedValue(false);
});

describe("GitHub settings", () => {
  it("explains missing encryption and disables app creation", () => {
    setSettings({
      encryptionConfigured: false,
      app: null,
      repositories: [],
      connectionError: null,
    });

    renderSettings();

    expect(screen.getByRole("alert")).toHaveTextContent("FEEDBACKBEE_APP_KEY");
    expect(screen.getByRole("button", { name: "Create personal app" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create org app" })).toBeDisabled();
  });

  it("shows a ready app and its installed repositories", () => {
    setSettings({
      encryptionConfigured: true,
      app: { slug: "feedbackbee", name: "FeedbackBee" },
      repositories: [repository],
      connectionError: null,
    });
    setRepositories([repository]);

    renderSettings();

    expect(screen.getByText("GitHub App: feedbackbee")).toBeInTheDocument();
    expect(screen.getByText("acme/feedback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install or reconnect" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });

  it.each([
    ["connected", "GitHub App created."],
    ["installed", "GitHub App installation updated."],
    ["error", "GitHub could not complete the setup."],
  ])("shows the %s callback status", (callback, message) => {
    renderSettings(`/app/settings?github=${callback}`);

    expect(screen.getByRole(callback === "error" ? "alert" : "status")).toHaveTextContent(message);
  });

  it("posts the returned manifest to GitHub as a hidden JSON field", async () => {
    const user = userEvent.setup();
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const manifest = { name: "FeedbackBee", url: "https://example.test" };
    mocks.post.mockResolvedValue({
      url: "https://github.com/settings/apps/new?manifest=true",
      manifest,
    });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Create personal app" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(mocks.post).toHaveBeenCalledWith("/github/manifest", {});
    const form = document.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "https://github.com/settings/apps/new?manifest=true");
    expect(form?.querySelector('input[name="manifest"]')).toHaveValue(JSON.stringify(manifest));
    submit.mockRestore();
  });
});
