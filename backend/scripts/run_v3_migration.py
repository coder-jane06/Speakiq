"""
Run this script once to add the missing preference columns to user_profiles.
Usage: python backend/scripts/run_v3_migration.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

import requests

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env")
    sys.exit(1)

STATEMENTS = [
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coaching_style TEXT DEFAULT 'Balanced'",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS feedback_detail TEXT DEFAULT 'Detailed'",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appearance_preferences JSONB NOT NULL DEFAULT '{"accentColor":"green","uiDensity":"Comfortable","roundedCorners":24}'::jsonb""",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"dailyReminder":true,"weeklyReport":true,"achievements":true,"sessionCompletion":true,"streakAlerts":true,"email":false,"push":true}'::jsonb""",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS audio_preferences JSONB NOT NULL DEFAULT '{"mic":"Default Microphone (Built-in Audio)","noiseCancellation":true,"sensitivity":75,"autoGain":true,"quality":"HD 256kbps Studio","voiceEnhancement":true,"livePreview":false}'::jsonb""",
    "CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)",
]

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

print(f"Connecting to {SUPABASE_URL}...\n")

# Try the Supabase REST RPC for exec_sql
for sql in STATEMENTS:
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql_query": sql},
            timeout=15,
        )
        if resp.status_code in (200, 204):
            print(f"  OK : {sql[:80]}...")
        else:
            print(f"  RPC unavailable ({resp.status_code}): {resp.text[:120]}")
            print("\nPlease run this SQL manually in your Supabase SQL editor:")
            print("  https://supabase.com/dashboard/project/gakfjshqzwtgqpkftnyd/sql")
            print()
            for s in STATEMENTS:
                print(f"  {s};")
            sys.exit(1)
    except Exception as e:
        print(f"  ERROR: {e}")
        print("\nPlease run this SQL manually in your Supabase SQL editor:")
        print("  https://supabase.com/dashboard/project/gakfjshqzwtgqpkftnyd/sql")
        print()
        for s in STATEMENTS:
            print(f"  {s};")
        sys.exit(1)

print("\nMigration complete!")
