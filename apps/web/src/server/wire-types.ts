/**
 * What the dashboard API sends, for the client to import type-only (dates
 * arrive as ISO strings). Erased at build: no server code reaches the bundle.
 * A leaf: it may import only schema modules (`db/schema` and zod-only
 * feature `.schema.ts` files under `api/`), never a service or route.
 */
import type { Feedback, Project } from "./db/schema";
import type { NotificationSettings } from "./api/notifications/notifications.schema";

export type { FeedbackKind, FeedbackStatus, LabelsMap } from "./db/schema";

type Wire<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };

export type ProjectDTO = Wire<Project>;
export type FeedbackItemDTO = Wire<Feedback> & { images: string[] };
export type FeedbackPageDTO = { items: FeedbackItemDTO[]; hasMore: boolean };

export type GithubRepositoryDTO = { id: number; fullName: string; installationId: number };
export type GithubSettingsDTO = {
  encryptionConfigured: boolean;
  /** `webhooks`: false for apps registered before webhook sync; reconnect to enable. */
  app: { slug: string; name: string; webhooks: boolean } | null;
  repositories: GithubRepositoryDTO[];
  connectionError: string | null;
};

export type { NotificationSettings };
export type NotificationSettingsDTO = {
  /** `PUSHOVER_USER_KEY` and `PUSHOVER_API_TOKEN` are both set. */
  configured: boolean;
  settings: NotificationSettings;
};
