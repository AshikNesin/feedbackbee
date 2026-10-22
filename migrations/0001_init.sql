CREATE TABLE project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  github_repo TEXT NOT NULL,
  github_pat_enc TEXT NOT NULL,
  labels_map TEXT NOT NULL DEFAULT '{"bug":"bug","idea":"enhancement","feedback":"feedback"}',
  created_at INTEGER NOT NULL
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bug','idea','feedback')),
  text TEXT NOT NULL,
  reporter_email TEXT,
  url TEXT,
  user_agent TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  media_kind TEXT NOT NULL DEFAULT 'none' CHECK (media_kind IN ('none','screenshot','recording')),
  media_key TEXT,
  media_seconds REAL,
  app_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_model TEXT,
  issue_number INTEGER,
  issue_url TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','created','issue_error','deleted')),
  issue_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_feedback_project ON feedback(project_id, created_at DESC);

CREATE TABLE admin (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limit (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE session (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
