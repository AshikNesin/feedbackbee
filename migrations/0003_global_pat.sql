-- GitHub auth moves to one global PAT (Worker secret GITHUB_TOKEN).
-- Per-project tokens, the APP_SECRET encryption layer, and the app_secret
-- table are gone. Existing deployments drop the column and table; the
-- data in them is unusable after the switch, so nothing is migrated.
DROP TABLE IF EXISTS app_secret;
ALTER TABLE project DROP COLUMN github_pat_enc;
