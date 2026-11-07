import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
import type { GithubRepositoryDTO, GithubSettingsDTO } from "../../../server/wire-types";

export const githubSettingsKey = ["github", "settings"] as const;
export const githubRepositoriesKey = ["github", "repositories"] as const;

export function useGithubSettings() {
  return useQuery({
    queryKey: githubSettingsKey,
    queryFn: () => apiClient.get<GithubSettingsDTO>("/github"),
  });
}

export function useGithubRepositories() {
  return useQuery({
    queryKey: githubRepositoriesKey,
    queryFn: () => apiClient.get<GithubRepositoryDTO[]>("/github/repositories"),
  });
}
