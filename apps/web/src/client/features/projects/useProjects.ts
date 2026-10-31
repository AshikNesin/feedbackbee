import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
import { useToastMutation } from "@groot/shell/hooks/useToastMutation";
import type { LabelsMap, ProjectDTO } from "../../../server/wire-types";

export const projectsKey = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => apiClient.get<ProjectDTO[]>("/projects"),
  });
}

/** The project a route's `:slug` names, from the cached list. */
export function useProject(slug: string | undefined) {
  const projects = useProjects();
  return { ...projects, project: projects.data?.find((p) => p.slug === slug) };
}

export interface ProjectInput {
  name: string;
  slug: string;
  githubRepo: string;
}

export function useCreateProject(onCreated: (project: ProjectDTO) => void) {
  const queryClient = useQueryClient();
  return useToastMutation((input: ProjectInput) => apiClient.post<ProjectDTO>("/projects", input), {
    success: (project) => `Created ${project.name}`,
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectsKey });
      onCreated(project);
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useToastMutation(
    (input: { name: string; githubRepo: string; labels: LabelsMap; allowedOrigins: string[] }) =>
      apiClient.patch<ProjectDTO>(`/projects/${id}`, input),
    {
      success: "Project saved",
      onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    },
  );
}

export function useDeleteProject(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useToastMutation((id: string) => apiClient.delete<{ id: string }>(`/projects/${id}`), {
    success: "Project deleted",
    error: "Couldn't delete the project",
    onSuccess: async () => {
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: projectsKey });
    },
  });
}
