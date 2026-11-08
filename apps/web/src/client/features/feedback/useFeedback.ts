import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
import type { FeedbackPageDTO, FeedbackStatus } from "../../../server/wire-types";

const feedbackKey = (projectId: string) => ["projects", projectId, "feedback"] as const;

/** A project's feedback, newest first, a page at a time (cursor: the last item's createdAt). */
export function useFeedback(projectId: string, status?: FeedbackStatus) {
  return useInfiniteQuery({
    queryKey: [...feedbackKey(projectId), status ?? "all"],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<FeedbackPageDTO>(`/projects/${projectId}/feedback`, {
        before: pageParam,
        status,
      }),
    getNextPageParam: (page) => {
      const last = page.items.at(-1);
      return page.hasMore && last ? Date.parse(last.createdAt) : undefined;
    },
  });
}

/** Change a report's status; the server updates its GitHub issue too. */
export function useSetFeedbackStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) =>
      apiClient.patch<{ id: string; status: FeedbackStatus }>(
        `/projects/${projectId}/feedback/${id}`,
        { status },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedbackKey(projectId) }),
  });
}

/** Pull issue statuses from GitHub for the project's recent reports. */
export function useSyncStatuses(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ checked: number; updated: number }>(`/projects/${projectId}/sync`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKey(projectId) }),
  });
}
