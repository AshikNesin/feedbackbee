import { jobsApi } from "./api";
import { stateLabel } from "./constants";
import { jobsKeys } from "./queries";
import { formatJobId } from "./utils";
import type { Job, JobAction } from "./types";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAction } from "@groot/shell/lib/feedback";

type JobRef = Pick<Job, "id" | "name">;

const STATE_CHANGES = {
  retry: { call: jobsApi.retryJob, success: "Job has been queued for retry" },
  resume: { call: jobsApi.resumeJob, success: "Job has been resumed" },
  cancel: { call: jobsApi.cancelJob, success: "Job has been cancelled" },
} satisfies Partial<Record<JobAction, unknown>>;

/**
 * Runs job actions with the dashboard's standard behaviour, through the
 * shell's `useAction`: destructive and bulk actions ask for confirmation,
 * every action toasts its outcome (failures worded by `describeError`), a
 * second click while one runs is ignored, and the list, the stats and the
 * affected detail query refetch afterwards.
 */
export function useJobActions({ onDeleted }: { onDeleted?: () => void } = {}) {
  const queryClient = useQueryClient();
  const lists = [jobsKeys.list, jobsKeys.stats];

  const rerun = useAction((job: JobRef) => jobsApi.rerunJob(job.id), {
    success: (result) => ({
      title: "Success",
      description: (
        <span>
          Job re-run created.{" "}
          <Link
            to={`/jobs/${result.newJobId}`}
            className="underline font-medium hover:text-foreground"
          >
            View new job ({formatJobId(result.newJobId)})
          </Link>
        </span>
      ),
    }),
    errorTitle: "Error",
    fallback: "Failed to re-run job",
    invalidate: lists,
  });

  const remove = useAction((job: JobRef) => jobsApi.deleteJob(job.id), {
    confirm: (job) => ({
      title: `Delete job ${job.name} (${formatJobId(job.id)})?`,
      description: "This permanently deletes the job and cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    }),
    success: { title: "Success", description: "Job has been deleted" },
    errorTitle: "Error",
    fallback: "Failed to delete job",
    invalidate: lists,
    onSuccess: (_, job) => {
      onDeleted?.();
      queryClient.removeQueries({ queryKey: jobsKeys.detail(job.id) });
    },
  });

  const changeState = useAction(
    ({ action, job }: { action: keyof typeof STATE_CHANGES; job: JobRef }) =>
      STATE_CHANGES[action].call(job.id),
    {
      success: (_, { action }) => ({
        title: "Success",
        description: STATE_CHANGES[action].success,
      }),
      errorTitle: "Error",
      fallback: ({ action }) => `Failed to ${action} job`,
      invalidate: (_, { job }) => [...lists, jobsKeys.detail(job.id)],
    },
  );

  const bulkRerun = useAction((jobIds: string[]) => jobsApi.rerunJobs(jobIds), {
    confirm: (jobIds) => ({
      title: `Re-run ${jobIds.length} selected job${jobIds.length === 1 ? "" : "s"}?`,
      description: "Each job will be enqueued again as a new job.",
      confirmLabel: "Re-run",
    }),
    success: (results) => ({
      title: "Bulk Action Completed",
      description: `Successfully triggered re-run for ${results.filter((r) => r.success).length} of ${results.length} jobs.`,
    }),
    errorTitle: "Error",
    fallback: "Failed to re-run jobs",
    invalidate: lists,
  });

  const purgeState = useAction((state: string) => jobsApi.purgeJobsByState(state), {
    confirm: (state) => ({
      title: `Purge all ${stateLabel(state)} jobs?`,
      description: "This permanently deletes every job in this state and cannot be undone.",
      confirmLabel: "Purge",
      destructive: true,
    }),
    success: ({ deletedCount }, state) => ({
      title: "Success",
      description: `Purged ${deletedCount} ${stateLabel(state)} jobs`,
    }),
    errorTitle: "Error",
    fallback: "Failed to purge jobs",
    invalidate: lists,
  });

  /** Apply one lifecycle action to one job. */
  const run = async (action: JobAction, job: JobRef): Promise<void> => {
    if (action === "rerun") await rerun.run(job);
    else if (action === "delete") await remove.run(job);
    else await changeState.run({ action, job });
  };

  /** Re-run several jobs after confirmation. Resolves true when the request went through. */
  const rerunMany = async (jobIds: string[]): Promise<boolean> => {
    if (jobIds.length === 0) return false;
    return (await bulkRerun.run(jobIds)).ok;
  };

  /** Delete every job in `state` after confirmation. */
  const purge = async (state: string): Promise<void> => {
    await purgeState.run(state);
  };

  return {
    run,
    rerunMany,
    purge,
    /** True while any of these actions is running. */
    isPending:
      rerun.isPending ||
      remove.isPending ||
      changeState.isPending ||
      bulkRerun.isPending ||
      purgeState.isPending,
  };
}
