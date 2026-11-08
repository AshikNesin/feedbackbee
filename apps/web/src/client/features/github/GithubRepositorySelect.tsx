import { Field } from "@groot/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@groot/ui/select";
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-required={required}>
          <SelectValue placeholder="Choose a repository" />
        </SelectTrigger>
        <SelectContent>
          {currentUnavailable && (
            <SelectItem value={value} disabled>
              {value} (not accessible)
            </SelectItem>
          )}
          {repositories.data?.map((repository) => (
            <SelectItem
              key={`${repository.installationId}:${repository.id}`}
              value={repository.fullName}
            >
              {repository.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
