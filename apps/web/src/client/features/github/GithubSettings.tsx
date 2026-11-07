import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Github, RefreshCw, Unplug } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@groot/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@groot/ui/card";
import { Field } from "@groot/ui/form";
import { Input } from "@groot/ui/input";
import { useConfirm } from "@groot/ui/primitives";
import { Text } from "@groot/ui/typography";
import { PageLayout } from "@groot/shell/components/layout/PageLayout";
import { apiClient } from "@groot/shell/lib/api";
import { errorMessage } from "../../lib/errors";
import { githubRepositoriesKey, githubSettingsKey, useGithubSettings } from "./useGithub";

type ManifestResponse = { url: string; manifest: object };

function submitManifest(url: string, manifest: object) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = url;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "manifest";
  input.value = JSON.stringify(manifest);
  form.append(input);
  document.body.append(form);
  form.submit();
}

export function GithubSettings() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const settings = useGithubSettings();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: githubSettingsKey }),
      queryClient.invalidateQueries({ queryKey: githubRepositoriesKey }),
    ]);
  };

  const manifest = useMutation({
    mutationFn: (organization?: string) =>
      apiClient.post<ManifestResponse>("/github/manifest", {
        ...(organization ? { organization } : {}),
      }),
    onSuccess: (result) => submitManifest(result.url, result.manifest),
  });
  const install = useMutation({
    mutationFn: () => apiClient.post<{ url: string }>("/github/install"),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const disconnect = useMutation({
    mutationFn: () => apiClient.post<{ disconnected: true }>("/github/disconnect"),
    onSuccess: refresh,
  });

  const callback = searchParams.get("github");
  const callbackError = searchParams.get("github_error");
  const callbackMessage =
    callback === "connected"
      ? "GitHub App created. Install it on the repositories that should receive feedback."
      : callback === "installed"
        ? "GitHub App installation updated. Your repository list is ready."
        : callback === "error"
          ? callbackError || "GitHub could not complete the setup. Try again."
          : null;

  const disconnectApp = async () => {
    const approved = await confirm({
      title: "Disconnect GitHub App?",
      description: "Projects will keep their selected repository, but feedback delivery will stop until GitHub is reconnected.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (approved) disconnect.mutate();
  };

  const refreshAll = async () => {
    await Promise.all([settings.refetch(), queryClient.invalidateQueries({ queryKey: githubRepositoriesKey })]);
  };

  return (
    <PageLayout
      title="GitHub App"
      description="Connect FeedbackBee to GitHub and choose which repositories can receive feedback."
      maxWidth="6xl"
    >
      {callbackMessage && (
        <div
          role={callback === "error" ? "alert" : "status"}
          className={callback === "error" ? "rounded-xl border border-destructive/30 bg-destructive/5 p-4" : "rounded-xl border border-success/30 bg-success/5 p-4"}
        >
          <Text tone={callback === "error" ? "destructive" : "success"}>{callbackMessage}</Text>
        </div>
      )}

      {settings.data && !settings.data.encryptionConfigured && (
        <div role="alert" className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <Text tone="warning">
            GitHub App credentials are not encrypted yet. Set the <code>FEEDBACKBEE_APP_KEY</code> secret before connecting GitHub.
          </Text>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>GitHub connection</CardTitle>
            <CardDescription>App credentials stay encrypted; only installed repositories are available to projects.</CardDescription>
          </div>
          <Button variant="outline" onClick={refreshAll} disabled={settings.isFetching}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {settings.isPending ? (
            <Text tone="muted">Loading GitHub connection…</Text>
          ) : settings.isError ? (
            <div role="alert" className="space-y-3">
              <Text tone="destructive">Couldn’t load GitHub settings: {errorMessage(settings.error)}</Text>
              <Button variant="outline" onClick={() => settings.refetch()}>Try again</Button>
            </div>
          ) : (
            <>
              {settings.data.app ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Github className="size-5 shrink-0" />
                    <div className="min-w-0">
                      <Text variant="title">{settings.data.app.name}</Text>
                      <p><Text variant="meta">GitHub App: {settings.data.app.slug}</Text></p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => install.mutate()} disabled={!settings.data.encryptionConfigured || install.isPending}>
                      <ExternalLink className="size-4" />
                      {install.isPending ? "Opening GitHub…" : "Install or reconnect"}
                    </Button>
                    <Button variant="outline" onClick={disconnectApp} disabled={disconnect.isPending}>
                      <Unplug className="size-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Text variant="title">Create a GitHub App</Text>
                    <p><Text variant="meta">Choose a personal account or enter an organization slug. GitHub will ask you to review and create the app.</Text></p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <Button
                      onClick={() => manifest.mutate(undefined)}
                      disabled={!settings.data.encryptionConfigured || manifest.isPending}
                    >
                      <Github className="size-4" />
                      Create personal app
                    </Button>
                    <div className="flex min-w-56 flex-1 items-end gap-2">
                      <Field label="Organization slug" htmlFor="github-organization" className="flex-1">
                        <Input id="github-organization" placeholder="my-organization" autoCapitalize="off" spellCheck={false} />
                      </Field>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const input = document.getElementById("github-organization") as HTMLInputElement | null;
                          const organization = input?.value.trim();
                          if (organization) manifest.mutate(organization);
                        }}
                        disabled={!settings.data.encryptionConfigured || manifest.isPending}
                      >
                        Create org app
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(manifest.error || install.error || disconnect.error) && (
                <Text role="alert" tone="destructive">
                  {errorMessage(manifest.error ?? install.error ?? disconnect.error!)}
                </Text>
              )}
              {settings.data.connectionError && (
                <div role="alert" className="rounded-xl border border-warning/40 bg-warning/5 p-4">
                  <Text tone="warning">GitHub connection issue: {settings.data.connectionError}</Text>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installed repositories</CardTitle>
          <CardDescription>Projects can select only repositories listed here.</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.data?.repositories.length ? (
            <ul className="divide-y divide-border">
              {settings.data.repositories.map((repository) => (
                <li key={`${repository.installationId}:${repository.id}`} className="py-3 first:pt-0 last:pb-0">
                  <Text>{repository.fullName}</Text>
                </li>
              ))}
            </ul>
          ) : (
            <Text tone="muted">No repositories are installed yet. Create or reconnect the app, then choose repositories on GitHub.</Text>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
