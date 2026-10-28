-- v1.1 attachments: multi-image reports, reporter context, renamed kinds.
-- SQLite cannot ALTER a CHECK constraint, so feedback is rebuilt in place.
PRAGMA defer_foreign_keys = true;

CREATE TABLE feedback_v11 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('issue','feature_request','other')),
  text TEXT NOT NULL,
  reporter_email TEXT,
  reporter_name TEXT,
  reporter_id TEXT,
  metadata TEXT,
  url TEXT,
  user_agent TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  media_kind TEXT NOT NULL DEFAULT 'none' CHECK (media_kind IN ('none','screenshot','recording')),
  media_key TEXT,
  media_seconds REAL,
  audio_key TEXT,
  audio_seconds REAL,
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

INSERT INTO feedback_v11 (
  id, project_id, kind, text, reporter_email, reporter_name, reporter_id, metadata,
  url, user_agent, screen_w, screen_h, media_kind, media_key, media_seconds,
  audio_key, audio_seconds, app_version, os_name, os_version, device_model,
  issue_number, issue_url, state, issue_error, created_at
)
SELECT
  id, project_id,
  CASE kind WHEN 'bug' THEN 'issue' WHEN 'idea' THEN 'feature_request' ELSE 'other' END,
  text, reporter_email, NULL, NULL, NULL,
  url, user_agent, screen_w, screen_h, media_kind, media_key, media_seconds,
  audio_key, audio_seconds, app_version, os_name, os_version, device_model,
  issue_number, issue_url, state, issue_error, created_at
FROM feedback;

DROP TABLE feedback;
ALTER TABLE feedback_v11 RENAME TO feedback;

-- Images of a report, in order. media_* on feedback describes only the
-- recording from here on; existing screenshots are backfilled at position 0.
CREATE TABLE feedback_image (
  feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY (feedback_id, position)
);

INSERT INTO feedback_image (feedback_id, position, key)
SELECT id, 0, media_key FROM feedback WHERE media_kind = 'screenshot' AND media_key IS NOT NULL;

-- Labels move to the new kind names.
UPDATE project SET labels_map = json_object(
  'issue', json_extract(labels_map, '$.bug'),
  'feature_request', json_extract(labels_map, '$.idea'),
  'other', json_extract(labels_map, '$.feedback')
);

CREATE INDEX idx_feedback_project ON feedback(project_id, created_at DESC);
