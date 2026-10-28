export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  GITHUB_TOKEN: string;
  MEDIA_BASE?: string;
  DASHBOARD_BASE?: string;
};

export type FeedbackKind = "bug" | "idea" | "feedback";
export type MediaKind = "none" | "screenshot" | "recording";
export type FeedbackState = "pending" | "created" | "issue_error" | "deleted";

export type LabelsMap = Partial<Record<FeedbackKind, string>>;

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  github_repo: string;
  labels_map: string;
  created_at: number;
};

export type FeedbackRow = {
  id: string;
  project_id: string;
  kind: FeedbackKind;
  text: string;
  reporter_email: string | null;
  url: string | null;
  user_agent: string | null;
  screen_w: number | null;
  screen_h: number | null;
  media_kind: MediaKind;
  media_key: string | null;
  media_seconds: number | null;
  audio_key: string | null;
  audio_seconds: number | null;
  app_version: string | null;
  os_name: string | null;
  os_version: string | null;
  device_model: string | null;
  issue_number: number | null;
  issue_url: string | null;
  state: FeedbackState;
  issue_error: string | null;
  created_at: number;
};
