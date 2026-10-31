import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
import type { FeedbackPageDTO } from "../../../server/wire-types";

/** A project's feedback, newest first, a page at a time (cursor: the last item's createdAt). */
export function useFeedback(projectId: string) {
  return useInfiniteQuery({
    queryKey: ["projects", projectId, "feedback"],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<FeedbackPageDTO>(`/projects/${projectId}/feedback`, {
        before: pageParam,
      }),
    getNextPageParam: (page) => {
      const last = page.items.at(-1);
      return page.hasMore && last ? Date.parse(last.createdAt) : undefined;
    },
  });
}
