import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@groot/ui/button";
import { Card } from "@groot/ui/card";
import { EmptyState, ErrorState } from "@groot/ui/empty-state";
import { SkeletonList } from "@groot/ui/loading-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@groot/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@groot/ui/tabs";
import { Text, monoClass } from "@groot/ui/typography";
import { PageLayout } from "@groot/shell/components/layout/PageLayout";
import type { FeedbackKind, ProjectDTO } from "../../server/wire-types";
import { FeedbackRow } from "../features/feedback/FeedbackRow";
import { KIND_LABELS, STATUSES, STATUS_LABELS } from "../features/feedback/format";
import { useFeedback, useSyncStatuses } from "../features/feedback/useFeedback";
import { ProjectSettingsDialog } from "../features/projects/ProjectSettingsDialog";
import { SetupDialog } from "../features/projects/SetupDialog";
import { useProject } from "../features/projects/useProjects";
import { errorMessage } from "../lib/errors";

const STATUS_FILTERS = ["all", ...STATUSES] as const;

const FILTERS = ["all", ...(Object.keys(KIND_LABELS) as FeedbackKind[])] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: "All",
  issue: "Issues",
  feature_request: "Feature requests",
  other: "Other",
};

/** `/projects/:slug`: a project's feedback inbox. `?feedback=<id>` opens one report. */
export function ProjectInbox() {
  const { slug } = useParams();
  const { project, isPending, isError } = useProject(slug);

  if (isPending)
    return (
      <PageLayout title="Loading…">
        <SkeletonList />
      </PageLayout>
    );
  if (isError || !project) return <Navigate to="/projects" replace />;
  return <ProjectFeedback key={project.id} project={project} />;
}

function ProjectFeedback({ project }: { project: ProjectDTO }) {
  const navigate = useNavigate();
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("all"),
  );
  const feedback = useFeedback(project.id, status === "all" ? undefined : status);
  const sync = useSyncStatuses(project.id);
  const [filter, setFilter] = useQueryState(
    "kind",
    parseAsStringLiteral(FILTERS).withDefault("all"),
  );
  const [openId, setOpenId] = useQueryState("feedback");

  const items = feedback.data?.pages.flatMap((page) => page.items) ?? [];
  const hasMore = feedback.hasNextPage;
  const shown = filter === "all" ? items : items.filter((item) => item.kind === filter);

  // A deep link (?feedback=<id>, from a GitHub issue) scrolls its report into view once loaded.
  const deepLinked = openId && items.some((item) => item.id === openId);
  useEffect(() => {
    if (deepLinked)
      document.getElementById(`feedback-${openId}`)?.scrollIntoView({ block: "center" });
    // Only on arrival, not on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(deepLinked)]);

  const count = (kind: (typeof FILTERS)[number]) =>
    kind === "all" ? items.length : items.filter((item) => item.kind === kind).length;

  return (
    <PageLayout
      title={project.name}
      description={
        <>
          <span className={monoClass}>{project.slug}</span> · issues go to{" "}
          <a
            href={`https://github.com/${project.githubRepo}`}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {project.githubRepo}
          </a>
        </>
      }
      actions={
        <>
          <Button
            variant="outline"
            disabled={sync.isPending}
            title="Refresh statuses from the GitHub issues"
            onClick={() => sync.mutate()}
          >
            <RefreshCw className="size-4" />
            {sync.isPending ? "Syncing…" : "Sync from GitHub"}
          </Button>
          <SetupDialog project={project} />
          <ProjectSettingsDialog
            project={project}
            onDeleted={() => navigate("/projects", { replace: true })}
          />
        </>
      }
    >
      {(sync.isError || sync.isSuccess) && (
        <p role={sync.isError ? "alert" : "status"}>
          <Text tone={sync.isError ? "destructive" : "muted"}>
            {sync.isError
              ? `Couldn't sync from GitHub: ${errorMessage(sync.error)}`
              : `Checked ${sync.data.checked} issues, ${sync.data.updated} updated.`}
          </Text>
        </p>
      )}
      {feedback.isPending ? (
        <SkeletonList />
      ) : feedback.isError ? (
        <ErrorState
          title="Couldn't load feedback"
          description={feedback.error.message}
          action={<Button onClick={() => feedback.refetch()}>Retry</Button>}
        />
      ) : items.length === 0 && status === "all" ? (
        <EmptyState
          icon={Inbox}
          title="No feedback yet"
          description="Add the snippet to your app. New feedback shows up here and in GitHub."
          action={<SetupDialog project={project} />}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={filter}
              onValueChange={(value) => void setFilter(value as (typeof FILTERS)[number])}
            >
              <TabsList>
                {FILTERS.map((kind) => (
                  <TabsTrigger key={kind} value={kind}>
                    {FILTER_LABELS[kind]}
                    {!hasMore && (
                      <span className="text-muted-foreground tabular-nums">{count(kind)}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Select
              value={status}
              onValueChange={(value) => void setStatus(value as (typeof STATUS_FILTERS)[number])}
            >
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nothing here"
              description={
                hasMore ? "Load more to look further back." : "No feedback matches these filters."
              }
            />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {shown.map((item) => (
                  <FeedbackRow
                    key={item.id}
                    projectId={project.id}
                    item={item}
                    open={openId === item.id}
                    onToggle={() => void setOpenId(openId === item.id ? null : item.id)}
                  />
                ))}
              </ul>
            </Card>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={feedback.isFetchingNextPage}
                onClick={() => void feedback.fetchNextPage()}
              >
                {feedback.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
