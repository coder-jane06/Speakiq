"""
SpeakIQ v2 — Full Migration Runner
Runs entirely via the Supabase REST API using the service key.
No SQL editor needed. Safe to re-run.
"""

import json
import sys
import os
import requests

# Load env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env")
    sys.exit(1)

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def supabase_select(table, select="*", filters=None, limit=1):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}"
    if filters:
        url += f"&{filters}"
    r = requests.get(url, headers=headers)
    return r.json() if r.ok else []

def supabase_insert(table, row):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.post(url, headers=headers, json=row)
    return r.ok, r.text

def supabase_upsert(table, rows, on_conflict=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = {**headers, "Prefer": "resolution=ignore-duplicates,return=minimal"}
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    r = requests.post(url, headers=h, json=rows)
    return r.ok, r.status_code, r.text

print("=" * 60)
print("SpeakIQ v2 Migration Runner")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────
# STEP 1: Check existing user_profiles columns
# by attempting to select the new columns
# ─────────────────────────────────────────────────────────────────
print("\n[1] Checking user_profiles schema...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/user_profiles?select=speaking_goal,difficulty_tier,onboarding_complete,recording_duration_secs&limit=1",
    headers=headers
)
if r.ok:
    print("    user_profiles new columns: ALREADY EXIST ✓")
    up_cols_ok = True
else:
    print("    user_profiles new columns: MISSING (need ALTER TABLE)")
    up_cols_ok = False

# ─────────────────────────────────────────────────────────────────
# STEP 2: Check topics new columns
# ─────────────────────────────────────────────────────────────────
print("\n[2] Checking topics schema...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/topics?select=goal_type,target_skill&limit=1",
    headers=headers
)
if r.ok:
    print("    topics new columns: ALREADY EXIST ✓")
    topics_cols_ok = True
else:
    print("    topics new columns: MISSING (need ALTER TABLE)")
    topics_cols_ok = False

# ─────────────────────────────────────────────────────────────────
# STEP 3: Check session_summaries table
# ─────────────────────────────────────────────────────────────────
print("\n[3] Checking session_summaries table...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/session_summaries?select=id&limit=1",
    headers=headers
)
summaries_ok = r.ok
print(f"    session_summaries: {'EXISTS ✓' if r.ok else 'MISSING'}")

# ─────────────────────────────────────────────────────────────────
# STEP 4: Check drill_completions table
# ─────────────────────────────────────────────────────────────────
print("\n[4] Checking drill_completions table...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/drill_completions?select=id&limit=1",
    headers=headers
)
drills_ok = r.ok
print(f"    drill_completions: {'EXISTS ✓' if r.ok else 'MISSING'}")

# ─────────────────────────────────────────────────────────────────
# STEP 5: Check topics count
# ─────────────────────────────────────────────────────────────────
print("\n[5] Checking topics count...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/topics?select=*",
    headers={**headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"}
)
topic_count = int(r.headers.get("content-range", "0/0").split("/")[-1]) if r.ok else 0
print(f"    topics in DB: {topic_count}")

# ─────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MIGRATION STATUS SUMMARY")
print("=" * 60)
print(f"  user_profiles new cols : {'✓ OK' if up_cols_ok else '✗ NEEDS SQL'}")
print(f"  topics new cols        : {'✓ OK' if topics_cols_ok else '✗ NEEDS SQL'}")
print(f"  session_summaries      : {'✓ OK' if summaries_ok else '✗ NEEDS SQL'}")
print(f"  drill_completions      : {'✓ OK' if drills_ok else '✗ NEEDS SQL'}")
print(f"  topics count           : {topic_count}")

needs_sql = not (up_cols_ok and topics_cols_ok and summaries_ok and drills_ok)

if needs_sql:
    print("\n" + "=" * 60)
    print("ACTION REQUIRED: Run the SQL below in Supabase SQL Editor")
    print("=" * 60)
    print("""
-- Paste this entire block in Supabase SQL Editor and click Run
-- Safe to run multiple times

-- 1. user_profiles new columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS speaking_goal            TEXT    DEFAULT 'general';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name             TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS difficulty_tier          TEXT    DEFAULT 'beginner';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete      BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS recording_duration_secs  INT     DEFAULT 60;

-- 2. topics new columns  
ALTER TABLE topics ADD COLUMN IF NOT EXISTS target_skill  TEXT DEFAULT 'general';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS goal_type     TEXT DEFAULT 'general';

-- 3. session_summaries table
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

-- 4. drill_completions table
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

-- 5. Back-fill existing topics
UPDATE topics SET goal_type    = 'general' WHERE goal_type    IS NULL;
UPDATE topics SET target_skill = 'general' WHERE target_skill IS NULL;
""")
else:
    print("\nAll structural migrations are DONE. Running topic seed...")

print("\nRun this script again after applying the SQL to seed topics.")
