import { users } from "@groot/core/database/schema";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "@groot/core/database/schema";

/**
 * App-owned tables. This file is the single schema entry point for
 * drizzle-kit (see `drizzle.config.ts`): it re-exports the core tables so one
 * migration history covers everything. FeedbackBee does not use groot's job
 * queue, so the jobs tables are not part of it.
 */

export const FEEDBACK_KINDS = ["issue", "feature_request", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** `pending` until GitHub answers; `issue_error` keeps the reason in `issueError`. */
export const FEEDBACK_STATES = ["pending", "created", "issue_error"] as const;
export type FeedbackState = (typeof FEEDBACK_STATES)[number];

/**
 * Triage status, kept in sync with the GitHub issue both ways (`lib/issue-status.ts`):
 * open, open + the `in progress` label, closed as completed, closed as not planned.
 */
export const FEEDBACK_STATUSES = ["open", "in_progress", "done", "wont_fix"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** GitHub label per feedback kind. A kind without a label files the issue unlabelled. */
export type LabelsMap = Partial<Record<FeedbackKind, string>>;

/** Reporter context from the widget/SDK, validated and normalised in `feedback.schema.ts`. */
export type FeedbackMetadata = Record<string, string | number | boolean>;

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Public project id used by the embed snippet and the Android SDK. */
  slug: text("slug").notNull().unique(),
  /** `owner/repo`, verified against the deployment's GitHub App installation. */
  githubRepo: text("github_repo").notNull(),
  labels: text("labels", { mode: "json" }).$type<LabelsMap>().notNull(),
  /**
   * Browser origins allowed to submit (lib/origins.ts). Empty: any site. Requests
   * without an Origin header (the Android SDK) are not affected.
   */
  allowedOrigins: text("allowed_origins", { mode: "json" }).$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: FEEDBACK_KINDS }).notNull(),
    text: text("text").notNull(),
    // Reporter-identifying fields: dashboard only, never sent to GitHub.
    reporterEmail: text("reporter_email"),
    reporterName: text("reporter_name"),
    reporterId: text("reporter_id"),
    metadata: text("metadata", { mode: "json" }).$type<FeedbackMetadata>(),
    url: text("url"),
    // Device context.
    userAgent: text("user_agent"),
    screenW: integer("screen_w"),
    screenH: integer("screen_h"),
    appVersion: text("app_version"),
    osName: text("os_name"),
    osVersion: text("os_version"),
    deviceModel: text("device_model"),
    // Attachments other than images (those live in feedback_images).
    recordingKey: text("recording_key"),
    recordingSeconds: real("recording_seconds"),
    audioKey: text("audio_key"),
    audioSeconds: real("audio_seconds"),
    // GitHub issue.
    state: text("state", { enum: FEEDBACK_STATES }).notNull().default("pending"),
    issueNumber: integer("issue_number"),
    issueUrl: text("issue_url"),
    issueError: text("issue_error"),
    status: text("status", { enum: FEEDBACK_STATUSES }).notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("feedback_project_created_idx").on(table.projectId, table.createdAt),
    index("feedback_project_status_created_idx").on(table.projectId, table.status, table.createdAt),
    index("feedback_issue_idx").on(table.issueNumber),
  ],
);

/** Images of a report, in the order the reporter attached them. */
export const feedbackImages = sqliteTable(
  "feedback_images",
  {
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    key: text("key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.feedbackId, table.position] })],
);

/**
 * Fixed-window counters for the public submit endpoint. In D1 rather than
 * memory: on Workers each isolate has its own memory, and the window is an hour.
 */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: integer("window_start").notNull(),
});

export type Project = typeof projects.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export * from "@groot/core/database/schema";

/** One end-user-owned GitHub App per deployment. Only ciphertext is persisted. */
export const githubApps = sqliteTable("github_apps", {
  id: integer("id").primaryKey(),
  appId: integer("app_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  privateKey: text("private_key").notNull(),
  /** Encrypted like `privateKey`. Null for apps registered before webhooks were enabled. */
  webhookSecret: text("webhook_secret"),
});

/** One-time browser-bound setup attempts; neither state nor cookie is stored raw. */
export const githubFlows = sqliteTable("github_flows", {
  state: text("state").primaryKey(),
  binding: text("binding").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["manifest", "install"] }).notNull(),
  expiresAt: integer("expires_at").notNull(),
});
