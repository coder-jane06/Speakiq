"""Run v3 migration - adds missing preference columns to user_profiles."""
import os, sys, requests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
print(f"URL: {URL}")
print(f"Key: {'set' if KEY else 'MISSING'}")

STMTS = [
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coaching_style TEXT DEFAULT 'Balanced'",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS feedback_detail TEXT DEFAULT 'Detailed'",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appearance_preferences JSONB NOT NULL DEFAULT '{"accentColor":"green","uiDensity":"Comfortable","roundedCorners":24}'::jsonb""",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"dailyReminder":true,"weeklyReport":true,"achievements":true,"sessionCompletion":true,"streakAlerts":true,"email":false,"push":true}'::jsonb""",
    """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS audio_preferences JSONB NOT NULL DEFAULT '{"noiseCancellation":true,"sensitivity":75,"autoGain":true,"voiceEnhancement":true}'::jsonb""",
]

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

print("\nTrying exec_sql RPC...")
rpc_works = False
for sql in STMTS:
    try:
        r = requests.post(
            f"{URL}/rest/v1/rpc/exec_sql",
            headers=HEADERS,
            json={"sql_query": sql},
            timeout=15,
        )
        short = sql[:70]
        if r.status_code in (200, 204):
            print(f"  OK  : {short}...")
            rpc_works = True
        else:
            print(f"  FAIL({r.status_code}): {r.text[:100]}")
            rpc_works = False
            break
    except Exception as e:
        print(f"  ERROR: {e}")
        rpc_works = False
        break

if not rpc_works:
    print("\n" + "="*60)
    print("RPC not available. Please run this SQL in Supabase dashboard:")
    print("https://supabase.com/dashboard/project/gakfjshqzwtgqpkftnyd/sql/new")
    print("="*60)
    print()
    for s in STMTS:
        print(f"{s};")
    print()
    sys.exit(1)

# Verify columns now exist
print("\nVerifying columns...")
from supabase import create_client
sb = create_client(URL, KEY)
try:
    r = sb.table('user_profiles').select(
        'coaching_style, feedback_detail, appearance_preferences, notification_preferences, audio_preferences'
    ).limit(1).execute()
    print("SUCCESS - all columns exist!")
    print("Sample data:", r.data)
except Exception as e:
    print(f"VERIFY FAILED: {e}")
    sys.exit(1)
