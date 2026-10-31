import { useState, type FormEvent } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@groot/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@groot/ui/dialog";
import { Field } from "@groot/ui/form";
import { Input } from "@groot/ui/input";
import { Textarea } from "@groot/ui/textarea";
import { useConfirm } from "@groot/ui/primitives";
import { Text } from "@groot/ui/typography";
import type { FeedbackKind, ProjectDTO } from "../../../server/wire-types";
import { KIND_LABELS } from "../feedback/format";
import { useDeleteProject, useUpdateProject } from "./useProjects";
import { errorMessage } from "../../lib/errors";

const KINDS = Object.keys(KIND_LABELS) as FeedbackKind[];

/** Rename, point at another repo, relabel, limit the allowed sites, or delete a project. */
export function ProjectSettingsDialog({
  project,
  onDeleted,
}: {
  project: ProjectDTO;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [githubRepo, setGithubRepo] = useState(project.githubRepo);
  const [labels, setLabels] = useState(project.labels);
  const [origins, setOrigins] = useState(project.allowedOrigins.join("\n"));
  const update = useUpdateProject(project.id);
  const remove = useDeleteProject(onDeleted);
  const confirm = useConfirm();

  const reset = (next: boolean) => {
    if (next) {
      setName(project.name);
      setGithubRepo(project.githubRepo);
      setLabels(project.labels);
      setOrigins(project.allowedOrigins.join("\n"));
      update.reset();
    }
    setOpen(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = Object.fromEntries(
      Object.entries(labels).filter(([, label]) => label && label.trim() !== ""),
    );
    await update.mutateAsync({
      name: name.trim(),
      githubRepo: githubRepo.trim(),
      labels: cleaned,
      // one per line (commas work too); the server validates and normalizes them
      allowedOrigins: origins
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean),
    });
    setOpen(false);
  };

  const deleteProject = async () => {
    const confirmed = await confirm({
      title: `Delete ${project.name}?`,
      description:
        "Its feedback is deleted from FeedbackBee. GitHub issues and uploaded media stay.",
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (confirmed) remove.mutate(project.id);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Project settings"
        onClick={() => reset(true)}
      >
        <Settings2 className="size-4" />
      </Button>
      <DialogContent dismissOnOutsideClick={false}>
        <form onSubmit={(e) => void submit(e).catch(() => undefined)} className="contents">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>
              Project id <code>{project.slug}</code> is fixed: it is in your embed snippets.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Name" htmlFor="ps-name">
              <Input id="ps-name" value={name} required onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="GitHub repo" htmlFor="ps-repo">
              <Input
                id="ps-repo"
                value={githubRepo}
                required
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </Field>
            <Field
              label="Issue labels"
              description="Leave one empty to file that kind without a label."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {KINDS.map((kind) => (
                  <Input
                    key={kind}
                    aria-label={`Label for ${KIND_LABELS[kind]}`}
                    placeholder={KIND_LABELS[kind]}
                    value={labels[kind] ?? ""}
                    onChange={(e) => setLabels({ ...labels, [kind]: e.target.value })}
                  />
                ))}
              </div>
            </Field>
            <Field
              label="Allowed sites"
              htmlFor="ps-origins"
              description="Websites that may send feedback to this project, one per line. Leave empty to accept any site."
              hint="Like https://example.com, http://localhost:3000 or https://*.example.com. Android apps are not affected."
            >
              <Textarea
                id="ps-origins"
                rows={3}
                value={origins}
                placeholder="https://example.com"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setOrigins(e.target.value)}
              />
            </Field>
            {update.error && <Text tone="destructive">{errorMessage(update.error)}</Text>}
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={deleteProject}
              disabled={remove.isPending}
            >
              Delete project
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
