-- ================================================================
-- SpeakIQ v2 FINAL MIGRATION — Paste ALL of this in one go
-- Supabase Dashboard > SQL Editor > New Query > Run
-- Safe to re-run (IF NOT EXISTS everywhere)
-- Does NOT touch your 43 sessions, 37 metrics, 1 profile, 30 topics
-- ================================================================

-- 1. user_profiles — 5 new columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS speaking_goal            TEXT    DEFAULT 'general';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name             TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS difficulty_tier          TEXT    DEFAULT 'beginner';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete      BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS recording_duration_secs  INT     DEFAULT 60;

-- 2. topics — 2 new columns (tier and category already exist, DO NOT add them)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS target_skill  TEXT DEFAULT 'general';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS goal_type     TEXT DEFAULT 'general';

-- 3. session_summaries (AI memory per session)
CREATE TABLE IF NOT EXISTS session_summaries (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL,
    session_id         UUID        NOT NULL,
    session_number     INT,
    created_at         TIMESTAMPTZ DEFAULT now(),
    summary_text       TEXT        NOT NULL DEFAULT '',
    scores             JSONB       NOT NULL DEFAULT '{}',
    top_issues         TEXT[]      DEFAULT '{}',
    drill_given        TEXT,
    drill_completed    BOOLEAN     DEFAULT FALSE,
    advice_given       TEXT[]      DEFAULT '{}',
    recurring_patterns JSONB       DEFAULT '[]',
    topic_text         TEXT,
    speaking_goal      TEXT        DEFAULT 'general'
);
CREATE INDEX IF NOT EXISTS idx_ssumm_user ON session_summaries(user_id, created_at DESC);
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own summaries" ON session_summaries;
CREATE POLICY "Users own summaries" ON session_summaries FOR ALL USING (auth.uid() = user_id);

-- 4. drill_completions (track completed drills)
CREATE TABLE IF NOT EXISTS drill_completions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL,
    session_id   UUID,
    drill_text   TEXT        NOT NULL DEFAULT '',
    drill_type   TEXT        NOT NULL DEFAULT 'daily_drill',
    completed_at TIMESTAMPTZ DEFAULT now(),
    self_rating  INT         CHECK (self_rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS idx_drill_comp_user ON drill_completions(user_id, completed_at DESC);
ALTER TABLE drill_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own drill_completions" ON drill_completions;
CREATE POLICY "Users own drill_completions" ON drill_completions FOR ALL USING (auth.uid() = user_id);

-- 5. Back-fill nulls in existing 30 topics (no data loss)
UPDATE topics SET goal_type    = 'general' WHERE goal_type    IS NULL;
UPDATE topics SET target_skill = 'general' WHERE target_skill IS NULL;

-- 6. Verify (you should see 5 rows of results)
SELECT 'user_profiles new cols'   AS check_name, count(*) AS result FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name IN ('speaking_goal','display_name','difficulty_tier','onboarding_complete','recording_duration_secs');
SELECT 'topics new cols'          AS check_name, count(*) AS result FROM information_schema.columns WHERE table_schema='public' AND table_name='topics' AND column_name IN ('target_skill','goal_type');
SELECT 'session_summaries exists' AS check_name, count(*) AS result FROM session_summaries;
SELECT 'drill_completions exists'  AS check_name, count(*) AS result FROM drill_completions;
SELECT 'existing sessions safe'    AS check_name, count(*) AS result FROM sessions;
