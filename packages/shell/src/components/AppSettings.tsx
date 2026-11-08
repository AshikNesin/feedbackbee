import { Button } from "@groot/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@groot/ui/card";
import { EmptyState } from "@groot/ui/empty-state";
import { Input } from "@groot/ui/input";
import { Form, FormField, Field } from "@groot/ui/form";
import { Skeleton, SkeletonCard, SkeletonList } from "@groot/ui/loading-skeleton";
import { useConfirm } from "@groot/ui/primitives";
import { Plus, RefreshCw, Search, Trash2, Save, FileJson, Undo2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { z } from "zod";
import { useAppSettingsData } from "@groot/shell/hooks/useAppSettingsData";
import { useSettingDraft } from "@groot/shell/hooks/useSettingDraft";
import { useAction } from "@groot/shell/lib/feedback";
import { cn } from "@groot/ui/lib/utils";

const settingKeySchema = z.object({
  key: z.string().trim().min(1, "Key is required"),
});

const CodeMirrorEditor = lazy(() =>
  import("./CodeMirrorEditor").then((m) => ({ default: m.CodeMirrorEditor })),
);

/**
 * Placeholder mirroring the toolbar and master/detail grid while settings
 * load, composed from the shared skeleton primitives.
 */
function AppSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-xl" />
          <Skeleton className="h-7 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="gap-0 p-0">
          <div className="border-b border-border p-3">
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <SkeletonList rows={3} leading="none" trailing={false} />
        </Card>
        <SkeletonCard titleWidth="w-40" description>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}

export function AppSettings() {
  const data = useAppSettingsData();
  const confirm = useConfirm();

  // Editor state: which setting is open, the list filter, the new-setting form.
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewSettingForm, setShowNewSettingForm] = useState(false);

  // Selection: the user's explicit choice, else the first setting once loaded.
  const selectedKey = userSelectedKey ?? data.settings[0]?.key ?? null;
  const selected = selectedKey ? data.get(selectedKey) : null;
  const draft = useSettingDraft(selected);

  const filteredSettings = data.settings.filter((setting) =>
    setting.key.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const save = useAction(
    (key: string) => data.save(key, draft.parse(), draft.description || undefined),
    {
      success: (saved) => `"${saved.key}" updated successfully`,
      errorTitle: "Save failed",
      fallback: "Unable to update setting",
    },
  );

  const remove = useAction((key: string) => data.remove(key), {
    confirm: (key) => ({
      title: "Delete setting",
      description: `Are you sure you want to delete “${key}”? This action cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    }),
    success: "Setting deleted successfully",
    errorTitle: "Delete failed",
    fallback: "Unable to delete setting",
    onSuccess: () => setUserSelectedKey(null),
  });

  const create = useAction((key: string) => data.create(key, {}, "New setting"), {
    success: (created) => `"${created.key}" created successfully`,
    errorTitle: "Create failed",
    fallback: "Unable to create setting",
    onSuccess: (created) => {
      setUserSelectedKey(created.key);
      setShowNewSettingForm(false);
    },
  });

  /** Leaving a dirty draft (another setting, a new one) asks first. */
  const leaveDraft = async (): Promise<boolean> =>
    !draft.isDirty ||
    confirm({
      title: "Discard unsaved changes?",
      description: `Your edits to “${selectedKey}” have not been saved.`,
      confirmLabel: "Discard",
      destructive: true,
    });

  const selectKey = async (key: string) => {
    if (key === selectedKey) return;
    if (await leaveDraft()) setUserSelectedKey(key);
  };

  const createSetting = async (key: string) => {
    if (await leaveDraft()) await create.run(key);
  };

  if (data.isLoading) {
    return <AppSettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileJson className="size-4" />
          <span>Application configuration stored as JSON.</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void data.refresh()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNewSettingForm(true)}>
            <Plus className="size-3.5" />
            Add setting
          </Button>
        </div>
      </div>

      {/* Add-setting inline form */}
      {showNewSettingForm && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">New setting</CardTitle>
            <CardDescription className="text-xs">
              Give it a descriptive key — you can edit the value next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form
              schema={settingKeySchema}
              defaultValues={{ key: "" }}
              onSubmit={({ key }) => createSetting(key)}
              className="flex items-start gap-2"
            >
              <FormField name="key" className="flex-1">
                <Input placeholder="e.g. featureFlags, theme, rateLimits" />
              </FormField>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNewSettingForm(false)}>
                Cancel
              </Button>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Master / detail */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Settings list */}
        <Card className="gap-0 p-0">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search settings…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="min-h-[120px] flex-1 p-1.5">
            {data.settings.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No settings yet.
              </p>
            ) : filteredSettings.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches.</p>
            ) : (
              <div className="space-y-0.5">
                {filteredSettings.map((setting) => {
                  const active = selectedKey === setting.key;
                  return (
                    <button
                      type="button"
                      key={setting.key}
                      onClick={() => void selectKey(setting.key)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2 text-left",
                        active ? "bg-muted" : "hover:bg-muted",
                      )}
                    >
                      <div
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {setting.key}
                      </div>
                      {setting.metadata?.description && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {setting.metadata.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Editor */}
        <Card className="gap-0 p-0">
          {selectedKey ? (
            <>
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="truncate">{selectedKey}</CardTitle>
                <CardDescription className="text-xs">
                  Edit the configuration below and save your changes.
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void remove.run(selectedKey)}
                  disabled={remove.isPending}
                  className="col-start-2 row-span-2 row-start-1 self-start justify-self-end text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </CardHeader>

              <CardContent className="space-y-5 px-5 py-4">
                <Field label="Description" htmlFor="description">
                  <Input
                    id="description"
                    value={draft.description}
                    onChange={(e) => draft.setDescription(e.target.value)}
                    placeholder="Brief description of this setting"
                  />
                </Field>
                <Field label="JSON value" htmlFor="jsonEditor">
                  <div className="overflow-hidden rounded-xl border border-input">
                    <Suspense fallback={<div className="h-[400px]" />}>
                      <CodeMirrorEditor
                        value={draft.jsonValue}
                        height="400px"
                        onChange={(value) => draft.setJsonValue(value)}
                        basicSetup={{
                          lineNumbers: true,
                          highlightActiveLineGutter: true,
                          highlightActiveLine: true,
                          foldGutter: true,
                        }}
                      />
                    </Suspense>
                  </div>
                </Field>
              </CardContent>

              <CardFooter className="mt-auto justify-end gap-2 px-5 py-3">
                {draft.isDirty && (
                  <p className="mr-auto text-xs text-muted-foreground" role="status">
                    {draft.serverChanged
                      ? "Unsaved changes. The saved value changed since you started editing."
                      : "Unsaved changes"}
                  </p>
                )}
                {draft.isDirty && (
                  <Button size="sm" variant="ghost" onClick={draft.discard}>
                    <Undo2 className="size-3.5" />
                    Discard
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => void save.run(selectedKey)}
                  disabled={save.isPending}
                >
                  <Save className="size-3.5" />
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
              </CardFooter>
            </>
          ) : (
            <EmptyState
              icon={FileJson}
              title="No setting selected"
              description="Choose a setting from the list to edit its value."
              className="h-96"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
