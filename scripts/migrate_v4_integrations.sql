-- ================================================================
-- Fluently v4 integrations preferences migration
-- Safe to re-run.
-- ================================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS integrations_preferences JSONB NOT NULL DEFAULT '{
  "gcal": true,
  "gdrive": false,
  "notion": true,
  "slack": false,
  "zoom": true,
  "teams": false
}'::jsonb;
