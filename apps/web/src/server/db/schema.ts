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

/** GitHub label per feedback kind. A kind without a label files the issue unlabelled. */
export type LabelsMap = Partial<Record<FeedbackKind, string>>;

/** Reporter context from the widget/SDK, validated and normalised in `feedback.schema.ts`. */
export type FeedbackMetadata = Record<string, string | number | boolean>;

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Public project id used by the embed snippet and the Android SDK. */
  slug: text("slug").notNull().unique(),
  /** `owner/repo`. Issues are filed with the deployment's GITHUB_TOKEN secret. */
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("feedback_project_created_idx").on(table.projectId, table.createdAt)],
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
