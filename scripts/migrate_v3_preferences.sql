-- ================================================================
-- SpeakIQ v3 preferences + adaptive dashboard migration
-- Safe to re-run.
-- ================================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coaching_style TEXT DEFAULT 'Balanced';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS feedback_detail TEXT DEFAULT 'Detailed';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appearance_preferences JSONB NOT NULL DEFAULT '{
  "accentColor": "green",
  "uiDensity": "Comfortable",
  "roundedCorners": 24
}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
  "dailyReminder": true,
  "weeklyReport": true,
  "achievements": true,
  "sessionCompletion": true,
  "streakAlerts": true,
  "email": false,
  "push": true
}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS audio_preferences JSONB NOT NULL DEFAULT '{
  "mic": "Default Microphone (Built-in Audio)",
  "noiseCancellation": true,
  "sensitivity": 75,
  "autoGain": true,
  "quality": "HD 256kbps Studio",
  "voiceEnhancement": true,
  "livePreview": false
}'::jsonb;

UPDATE user_profiles
SET speaking_goal = CASE lower(coalesce(speaking_goal, 'general'))
  WHEN 'interviews' THEN 'interviewer'
  WHEN 'interview' THEN 'interviewer'
  WHEN 'debates' THEN 'debater'
  WHEN 'debate' THEN 'debater'
  WHEN 'presentations' THEN 'presenter'
  WHEN 'presentation' THEN 'presenter'
  WHEN 'public speaking' THEN 'orator'
  WHEN 'public_speaking' THEN 'orator'
  ELSE coalesce(speaking_goal, 'general')
END;

UPDATE user_profiles
SET difficulty_tier = CASE lower(coalesce(difficulty_tier, 'beginner'))
  WHEN 'easy' THEN 'beginner'
  WHEN 'medium' THEN 'intermediate'
  WHEN 'hard' THEN 'advanced'
  ELSE coalesce(difficulty_tier, 'beginner')
END;

CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at
  ON sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
  ON user_profiles(user_id);

