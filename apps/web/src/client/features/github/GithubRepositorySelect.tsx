import { useId, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@groot/ui/button";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@groot/ui/command";
import { Field } from "@groot/ui/form";
import { Text } from "@groot/ui/typography";
import { useGithubRepositories } from "./useGithub";

export function GithubRepositorySelect({
  id,
  value,
  onChange,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const repositories = useGithubRepositories();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const currentUnavailable =
    Boolean(value) &&
    !repositories.isPending &&
    !repositories.data?.some((repository) => repository.fullName === value);

  return (
    <Field
      label="GitHub repo"
      htmlFor={id}
      hint={
        currentUnavailable
          ? "This repo is not accessible through the current GitHub App installation. Choose an accessible repo to change it."
          : repositories.data?.length
            ? "Feedback is filed as issues in this repo."
            : "Connect a GitHub App and install it on a repository in Settings."
      }
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
            aria-required={required}
            className="w-full justify-between"
          >
            <span className="truncate">
              {value
                ? `${value}${currentUnavailable ? " (not accessible)" : ""}`
                : "Choose a repository"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            id={popoverId}
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-xl border border-border bg-popover text-popover-foreground shadow-md"
          >
            <Command
              label="Search repositories"
              filter={(name, search) =>
                name.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput
                aria-label="Search repositories"
                placeholder="Search owner or repository…"
              />
              <CommandList>
                <CommandEmpty>
                  {repositories.isPending
                    ? "Loading repositories…"
                    : repositories.isError
                      ? "Couldn’t load repositories."
                      : "No matching repositories."}
                </CommandEmpty>
                {currentUnavailable && (
                  <CommandItem value={value} disabled>
                    {value} (not accessible)
                  </CommandItem>
                )}
                {repositories.data?.map((repository) => (
                  <CommandItem
                    key={`${repository.installationId}:${repository.id}`}
                    value={repository.fullName}
                    data-checked={value === repository.fullName}
                    onSelect={() => {
                      onChange(repository.fullName);
                      setOpen(false);
                    }}
                  >
                    {repository.fullName}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {repositories.isError && (
        <Text tone="destructive">
          Couldn’t load repositories. Refresh GitHub settings and try again.
        </Text>
      )}
      {!repositories.isPending && !repositories.isError && repositories.data?.length === 0 && (
        <Text variant="meta">No accessible repositories yet.</Text>
      )}
    </Field>
  );
}
