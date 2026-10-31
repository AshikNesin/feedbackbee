import { useState, type FormEvent } from "react";
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
import { Text } from "@groot/ui/typography";
import type { ProjectDTO } from "../../../server/wire-types";
import { useCreateProject } from "./useProjects";
import { errorMessage } from "../../lib/errors";

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: ProjectDTO) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [githubRepo, setGithubRepo] = useState("");
  const create = useCreateProject((project) => {
    onOpenChange(false);
    setName("");
    setSlug("");
    setSlugEdited(false);
    setGithubRepo("");
    onCreated(project);
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      name: name.trim(),
      slug: slug.replace(/-+$/, ""),
      githubRepo: githubRepo.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dismissOnOutsideClick={false}>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Feedback from this project becomes issues in one GitHub repo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Name" htmlFor="np-name">
              <Input
                id="np-name"
                value={name}
                required
                autoFocus
                placeholder="My app"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(toSlug(e.target.value));
                }}
              />
            </Field>
            <Field
              label="Project id"
              htmlFor="np-slug"
              hint="Used in the embed snippet and the Android SDK."
            >
              <Input
                id="np-slug"
                value={slug}
                required
                minLength={3}
                maxLength={40}
                placeholder="my-app"
                onChange={(e) => {
                  setSlug(toSlug(e.target.value));
                  setSlugEdited(true);
                }}
              />
            </Field>
            <Field
              label="GitHub repo"
              htmlFor="np-repo"
              hint="Issues are filed with this deployment's GitHub token."
            >
              <Input
                id="np-repo"
                value={githubRepo}
                required
                placeholder="owner/repo"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </Field>
            {create.error && <Text tone="destructive">{errorMessage(create.error)}</Text>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
