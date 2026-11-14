import { waitUntil } from "@groot/core/context";
import { env } from "@groot/core/env";
import { Boom } from "@groot/core/errors";
import { createNamespaceKv } from "@groot/core/kv";
import { logger } from "@groot/core/logger";
import {
  sendPushNotification,
  type PushNotification,
} from "@groot/core/notification/notification.service";
import type { Feedback, FeedbackStatus, Project } from "../../db";
import { inQuietHours } from "../../lib/quiet-hours";
import { notificationSettingsSchema, type NotificationSettings } from "./notifications.schema";

/**
 * Push notifications through Pushover. The credentials are the
 * `PUSHOVER_USER_KEY` / `PUSHOVER_API_TOKEN` env vars (groot core reads them);
 * when, for what and with which details is the owner's choice in Settings,
 * stored in core's `kv` table.
 *
 * Sending never fails or delays the request that triggered it: it runs in the
 * background (`waitUntil` on Workers) and a Pushover error is only logged.
 */

const store = createNamespaceKv("NOTIFICATIONS");
const SETTINGS_KEY = "settings";

/** Pushover's limits (https://pushover.net/api#limits). */
const MAX_TITLE = 250;
const MAX_MESSAGE = 1024;
const MAX_URL = 512;

const KIND_NAMES: Record<Feedback["kind"], string> = {
  issue: "Issue",
  feature_request: "Feature request",
  other: "Feedback",
};

const STATUS_NAMES: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  wont_fix: "Won't fix",
};

export function pushoverConfigured(): boolean {
  return Boolean(env.PUSHOVER_USER_KEY && env.PUSHOVER_API_TOKEN);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const stored = await store.get(SETTINGS_KEY);
  const parsed = notificationSettingsSchema.safeParse(stored ?? {});
  // A value that no longer validates (say, a removed time zone) falls back to the defaults.
  return parsed.success ? parsed.data : notificationSettingsSchema.parse({});
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  await store.set(SETTINGS_KEY, settings);
  return settings;
}

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/** The report details the owner chose to include, one per line. */
function details(row: Feedback, content: NotificationSettings["content"]): string[] {
  const lines: string[] = [];
  if (content.text) lines.push(row.text.trim() || "(no text)");
  if (content.reporter) {
    const who = [row.reporterName, row.reporterEmail && `<${row.reporterEmail}>`]
      .filter(Boolean)
      .join(" ");
    if (who) lines.push(`From: ${who}`);
  }
  if (content.context) {
    if (row.url) lines.push(`Page: ${row.url}`);
    const device = [
      row.appVersion && `v${row.appVersion}`,
      [row.osName, row.osVersion].filter(Boolean).join(" "),
      row.deviceModel,
    ].filter(Boolean);
    if (device.length > 0) lines.push(`Device: ${device.join(" · ")}`);
  }
  return lines;
}

type Delivery = Omit<PushNotification, "priority">;

/**
 * Send `notification` in the background when the settings allow it for this
 * project and kind. `build` runs only once the filters pass.
 */
function dispatch(
  project: Project,
  row: Feedback,
  wants: (settings: NotificationSettings) => boolean,
  build: (settings: NotificationSettings) => Delivery,
): void {
  if (!pushoverConfigured()) return;
  waitUntil(
    (async () => {
      const settings = await getNotificationSettings();
      if (!settings.enabled || !wants(settings)) return;
      if (!settings.kinds.includes(row.kind)) return;
      if (settings.projectIds.length > 0 && !settings.projectIds.includes(project.id)) return;
      const quiet = inQuietHours(settings.quietHours, new Date());
      if (quiet && settings.quietHours.mode === "skip") return;
      await deliver({ ...build(settings), priority: quiet ? -2 : settings.priority });
    })().catch((error: unknown) => {
      logger.warn({ err: error, feedbackId: row.id }, "Push notification failed");
    }),
  );
}

function deliver(notification: PushNotification): Promise<boolean> {
  return sendPushNotification({
    ...notification,
    title: clip(notification.title, MAX_TITLE),
    message: clip(notification.message, MAX_MESSAGE),
    url: notification.url && notification.url.length <= MAX_URL ? notification.url : undefined,
  });
}

/**
 * After a submit: "new feedback" when the issue was filed, "issue error" when
 * GitHub refused it (or "new feedback" with the error appended, if only that
 * event is on). One notification per report at most.
 */
export function notifyNewFeedback(
  project: Project,
  row: Feedback,
  outcome: { dashboardUrl: string; error?: string },
): void {
  const failed = outcome.error !== undefined;
  dispatch(
    project,
    row,
    (s) => s.events.newFeedback || (failed && s.events.issueError),
    (s) => {
      const lines = details(row, s.content);
      if (failed) lines.push(`GitHub issue not filed: ${outcome.error}`);
      return {
        title: failed
          ? `${project.name}: ${KIND_NAMES[row.kind]} (GitHub issue failed)`
          : `${project.name}: new ${KIND_NAMES[row.kind].toLowerCase()}`,
        message: lines.join("\n") || `A new ${KIND_NAMES[row.kind].toLowerCase()} arrived.`,
        url: outcome.dashboardUrl,
        urlTitle: "Open in FeedbackBee",
      };
    },
  );
}

/** A report's status changed on GitHub (the `issues` webhook). */
export function notifyStatusChange(
  project: Project,
  row: Feedback,
  change: { from: FeedbackStatus; to: FeedbackStatus },
): void {
  dispatch(
    project,
    row,
    (s) => s.events.statusChange,
    (s) => ({
      title: `${project.name}: ${STATUS_NAMES[change.from]} → ${STATUS_NAMES[change.to]}`,
      message: details(row, s.content).join("\n") || "A report's status changed on GitHub.",
      url: row.issueUrl ?? undefined,
      urlTitle: row.issueUrl ? `Issue #${row.issueNumber}` : undefined,
    }),
  );
}

/** "Send test notification": synchronous, so the owner sees Pushover's answer. */
export async function sendTestNotification(): Promise<{ sent: true }> {
  if (!pushoverConfigured()) {
    throw Boom.badRequest("Set PUSHOVER_USER_KEY and PUSHOVER_API_TOKEN to send notifications");
  }
  const settings = await getNotificationSettings();
  try {
    await deliver({
      title: "FeedbackBee",
      message: "Test notification: push notifications are working.",
      priority: settings.priority,
    });
  } catch (error) {
    throw Boom.unavailable(`Pushover refused the notification: ${(error as Error).message}`);
  }
  return { sent: true };
}
