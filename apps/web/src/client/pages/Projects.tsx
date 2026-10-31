import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderGit2, Plus } from "lucide-react";
import { Button } from "@groot/ui/button";
import { Card } from "@groot/ui/card";
import { EmptyState, ErrorState } from "@groot/ui/empty-state";
import { listRowClass } from "@groot/ui/list-row";
import { SkeletonList } from "@groot/ui/loading-skeleton";
import { Text, monoClass } from "@groot/ui/typography";
import { PageLayout } from "@groot/shell/components/layout/PageLayout";
import { NewProjectDialog } from "../features/projects/NewProjectDialog";
import { useProjects } from "../features/projects/useProjects";

/** Every project; each connects a widget (or app) to one GitHub repo. */
export function Projects() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" />
      New project
    </Button>
  );

  return (
    <PageLayout
      title="Projects"
      description="Each project files its feedback as issues in one GitHub repo."
      actions={newButton}
    >
      {projects.isPending ? (
        <SkeletonList />
      ) : projects.isError ? (
        <ErrorState
          title="Couldn't load projects"
          description={projects.error.message}
          action={<Button onClick={() => projects.refetch()}>Retry</Button>}
        />
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="Create your first project"
          description="A project connects your app's widget to a GitHub repo."
          action={newButton}
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.slug}`} className={listRowClass}>
                  <div className="min-w-0 flex-1">
                    <p>
                      <Text>{project.name}</Text>
                    </p>
                    <p>
                      <Text variant="meta">
                        <span className={monoClass}>{project.slug}</span> · {project.githubRepo}
                      </Text>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(project) => navigate(`/projects/${project.slug}`)}
      />
    </PageLayout>
  );
}
