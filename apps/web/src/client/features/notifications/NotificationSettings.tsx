import { useState, type FormEvent, type ReactNode } from "react";
import { BellRing, Send } from "lucide-react";
import { Button } from "@groot/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@groot/ui/card";
import { Checkbox } from "@groot/ui/checkbox";
import { Field } from "@groot/ui/form";
import { Input } from "@groot/ui/input";
import { Label } from "@groot/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@groot/ui/select";
import { monoClass, Text } from "@groot/ui/typography";
import type {
  FeedbackKind,
  NotificationSettings as Settings,
  ProjectDTO,
} from "../../../server/wire-types";
import { errorMessage } from "../../lib/errors";
import { KIND_LABELS } from "../feedback/format";
import { useProjects } from "../projects/useProjects";
import {
  useNotificationSettings,
  useSaveNotificationSettings,
  useTestNotification,
} from "./useNotifications";

const KINDS = Object.keys(KIND_LABELS) as FeedbackKind[];

const PRIORITIES: Array<{ value: Settings["priority"]; label: string }> = [
  { value: -2, label: "Lowest: no alert, just the badge" },
  { value: -1, label: "Low: no sound or vibration" },
  { value: 0, label: "Normal" },
  { value: 1, label: "High: bypasses the phone's quiet hours" },
];

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function Check({
  id,
  checked,
  onChange,
  disabled,
  children,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {children}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <div className="space-y-0.5">
        <legend className="text-sm font-semibold">{title}</legend>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </fieldset>
  );
}

const toggle = <T,>(list: T[], item: T, on: boolean) =>
  on ? [...new Set([...list, item])] : list.filter((value) => value !== item);

/** Settings → Push notifications: Pushover delivery, and when, for what, with which details. */
export function NotificationSettings() {
  const query = useNotificationSettings();
  return (
    <div className="space-y-6">
      {query.data && !query.data.configured && (
        <div role="alert" className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <Text tone="warning">
            Pushover is not configured. Set the <code className={monoClass}>PUSHOVER_USER_KEY</code>{" "}
            and <code className={monoClass}>PUSHOVER_API_TOKEN</code> environment variables (Worker
            secrets on Cloudflare) to send notifications. Your choices below are saved either way.
          </Text>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Notification rules</CardTitle>
          <CardDescription>
            Choose when you're notified, for which feedback, and what the message shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Text tone="muted">Loading notification settings…</Text>
          ) : query.isError ? (
            <div role="alert" className="space-y-3">
              <Text tone="destructive">
                Couldn’t load notification settings: {errorMessage(query.error)}
              </Text>
              <Button variant="outline" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <SettingsForm
              key={JSON.stringify(query.data.settings)}
              initial={query.data.settings}
              configured={query.data.configured}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsForm({ initial, configured }: { initial: Settings; configured: boolean }) {
  const [draft, setDraft] = useState(initial);
  const projects = useProjects();
  const save = useSaveNotificationSettings();
  const test = useTestNotification();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const off = !draft.enabled;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const setIn = <K extends "events" | "content" | "quietHours">(
    key: K,
    patch: Partial<Settings[K]>,
  ) => setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save.run(draft);
  };

  const allProjects = draft.projectIds.length === 0;
  const projectList: ProjectDTO[] = projects.data ?? [];

  return (
    <form onSubmit={submit} className="space-y-8">
      <Check
        id="notify-enabled"
        checked={draft.enabled}
        onChange={(enabled) => set("enabled", enabled)}
        hint="Turn off to pause every notification without losing your choices."
      >
        Send push notifications
      </Check>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="When" description="The events that send a notification.">
          <Check
            id="notify-new"
            checked={draft.events.newFeedback}
            disabled={off}
            onChange={(newFeedback) => setIn("events", { newFeedback })}
          >
            New feedback arrives
          </Check>
          <Check
            id="notify-issue-error"
            checked={draft.events.issueError}
            disabled={off}
            onChange={(issueError) => setIn("events", { issueError })}
            hint="The report is stored, but GitHub refused the issue."
          >
            A GitHub issue couldn't be filed
          </Check>
          <Check
            id="notify-status"
            checked={draft.events.statusChange}
            disabled={off}
            onChange={(statusChange) => setIn("events", { statusChange })}
            hint="An issue was closed, reopened or labelled in progress on GitHub (needs webhooks)."
          >
            Status changes on GitHub
          </Check>

          <div className="space-y-3 border-t pt-4">
            <Check
              id="notify-quiet"
              checked={draft.quietHours.enabled}
              disabled={off}
              onChange={(enabled) =>
                setIn("quietHours", {
                  enabled,
                  // A first-time setup starts in the browser's time zone.
                  ...(enabled &&
                  initial.quietHours.timeZone === "UTC" &&
                  !initial.quietHours.enabled
                    ? { timeZone: browserTimeZone() }
                    : {}),
                })
              }
            >
              Quiet hours
            </Check>
            {draft.quietHours.enabled && !off && (
              <div className="grid gap-3 pl-7 sm:grid-cols-2">
                <Field label="From" htmlFor="quiet-start">
                  <Input
                    id="quiet-start"
                    type="time"
                    required
                    value={draft.quietHours.start}
                    onChange={(e) => setIn("quietHours", { start: e.target.value })}
                  />
                </Field>
                <Field label="Until" htmlFor="quiet-end">
                  <Input
                    id="quiet-end"
                    type="time"
                    required
                    value={draft.quietHours.end}
                    onChange={(e) => setIn("quietHours", { end: e.target.value })}
                  />
                </Field>
                <Field label="Time zone" htmlFor="quiet-tz" className="sm:col-span-2">
                  <Input
                    id="quiet-tz"
                    required
                    placeholder="Europe/London"
                    value={draft.quietHours.timeZone}
                    onChange={(e) => setIn("quietHours", { timeZone: e.target.value })}
                  />
                </Field>
                <Field label="During quiet hours" htmlFor="quiet-mode" className="sm:col-span-2">
                  <Select
                    value={draft.quietHours.mode}
                    onValueChange={(mode) =>
                      setIn("quietHours", { mode: mode as Settings["quietHours"]["mode"] })
                    }
                  >
                    <SelectTrigger id="quiet-mode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="silent">Deliver silently</SelectItem>
                      <SelectItem value="skip">Don't send</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        </Section>

        <Section title="Which feedback" description="Only these kinds and projects notify.">
          <div className="space-y-3">
            {KINDS.map((kind) => (
              <Check
                key={kind}
                id={`notify-kind-${kind}`}
                checked={draft.kinds.includes(kind)}
                disabled={off}
                onChange={(on) => set("kinds", toggle(draft.kinds, kind, on))}
              >
                {KIND_LABELS[kind]}
              </Check>
            ))}
          </div>
          <div className="space-y-3 border-t pt-4">
            <Check
              id="notify-all-projects"
              checked={allProjects}
              disabled={off}
              onChange={(all) =>
                set("projectIds", all ? [] : projectList.slice(0, 1).map((p) => p.id))
              }
              hint="Includes projects you create later."
            >
              All projects
            </Check>
            {!allProjects &&
              !off &&
              projectList.map((project) => (
                <div key={project.id} className="pl-7">
                  <Check
                    id={`notify-project-${project.id}`}
                    checked={draft.projectIds.includes(project.id)}
                    onChange={(on) => set("projectIds", toggle(draft.projectIds, project.id, on))}
                  >
                    {project.name}
                  </Check>
                </div>
              ))}
          </div>
        </Section>

        <Section title="What" description="What the notification shows.">
          <Check
            id="notify-text"
            checked={draft.content.text}
            disabled={off}
            onChange={(text) => setIn("content", { text })}
          >
            Feedback text
          </Check>
          <Check
            id="notify-reporter"
            checked={draft.content.reporter}
            disabled={off}
            onChange={(reporter) => setIn("content", { reporter })}
            hint="Reporter name and email are sent to Pushover."
          >
            Reporter
          </Check>
          <Check
            id="notify-context"
            checked={draft.content.context}
            disabled={off}
            onChange={(context) => setIn("content", { context })}
          >
            Page, app version and device
          </Check>
        </Section>

        <Section title="How" description="How loudly Pushover alerts you.">
          <Field label="Priority" htmlFor="notify-priority">
            <Select
              value={String(draft.priority)}
              disabled={off}
              onValueChange={(value) => set("priority", Number(value) as Settings["priority"])}
            >
              <SelectTrigger id="notify-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={String(priority.value)}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>
      </div>

      {draft.enabled && draft.kinds.length === 0 && (
        <Text tone="warning">No feedback kind is selected, so nothing will be sent.</Text>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!dirty || save.isPending}>
          <BellRing className="size-4" />
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void test.run()}
          disabled={!configured || test.isPending}
        >
          <Send className="size-4" />
          {test.isPending ? "Sending…" : "Send test notification"}
        </Button>
      </div>
    </form>
  );
}
