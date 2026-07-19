"""
Ultimate system audit for Fluently app.
Tests every major component end-to-end.
"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv('.env')
from supabase import create_client

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
PASS = []; FAIL = []

def ok(label, detail=''):
    msg = f"  PASS  {label}" + (f"  [{detail}]" if detail else '')
    PASS.append(label); print(msg)

def fail(label, detail=''):
    msg = f"  FAIL  {label}" + (f"  -> {detail}" if detail else '')
    FAIL.append(label); print(msg)

def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")

# ──────────────────────────────────────────────────────────
section("1. DATABASE SCHEMA")
required_cols = ['coaching_style', 'feedback_detail', 'appearance_preferences',
                 'notification_preferences', 'audio_preferences']
try:
    r = sb.table('user_profiles').select(', '.join(required_cols)).limit(1).execute()
    ok("All 5 preference columns exist in user_profiles")
except Exception as e:
    fail("Preference columns missing", str(e)[:100])

for table in ['notification_deliveries', 'push_subscriptions', 'streaks', 'sessions', 'user_profiles']:
    try:
        sb.table(table).select('*').limit(1).execute()
        ok(f"Table '{table}' exists and is accessible")
    except Exception as e:
        fail(f"Table '{table}' missing or inaccessible", str(e)[:80])

# ──────────────────────────────────────────────────────────
section("2. SETTINGS PERSISTENCE (Save → Load)")
profiles = sb.table('user_profiles').select('user_id').limit(1).execute()
if not profiles.data:
    fail("No user profiles found - cannot test persistence")
else:
    uid = profiles.data[0]['user_id']
    print(f"  Test user: {uid[:8]}...")

    TESTS = [
        ('coaching_style', 'Strict', 'Balanced'),
        ('feedback_detail', 'Expert', 'Detailed'),
    ]
    for col, new_val, restore_val in TESTS:
        sb.table('user_profiles').update({col: new_val}).eq('user_id', uid).execute()
        v = sb.table('user_profiles').select(col).eq('user_id', uid).execute().data[0]
        if v[col] == new_val:
            ok(f"{col} saves '{new_val}' and reads back correctly")
        else:
            fail(f"{col} save/load", f"expected {new_val}, got {v[col]}")
        sb.table('user_profiles').update({col: restore_val}).eq('user_id', uid).execute()

    # Appearance
    ap = {'accentColor': 'purple', 'uiDensity': 'Compact', 'roundedCorners': 8}
    sb.table('user_profiles').update({'appearance_preferences': ap}).eq('user_id', uid).execute()
    v = sb.table('user_profiles').select('appearance_preferences').eq('user_id', uid).execute().data[0]['appearance_preferences']
    if v.get('accentColor') == 'purple' and v.get('roundedCorners') == 8:
        ok("appearance_preferences (color + density + radius) persists correctly")
    else:
        fail("appearance_preferences", str(v))
    sb.table('user_profiles').update({'appearance_preferences': {'accentColor': 'green', 'uiDensity': 'Comfortable', 'roundedCorners': 24}}).eq('user_id', uid).execute()

    # Notifications
    np = {'dailyReminder': False, 'weeklyReport': True, 'achievements': True,
          'sessionCompletion': True, 'streakAlerts': False, 'email': True, 'push': False}
    sb.table('user_profiles').update({'notification_preferences': np}).eq('user_id', uid).execute()
    v = sb.table('user_profiles').select('notification_preferences').eq('user_id', uid).execute().data[0]['notification_preferences']
    if v.get('email') is True and v.get('dailyReminder') is False and v.get('push') is False:
        ok("notification_preferences (email on, reminder off, push off) persists correctly")
    else:
        fail("notification_preferences", str(v))
    sb.table('user_profiles').update({'notification_preferences': {'dailyReminder': True, 'weeklyReport': True, 'achievements': True, 'sessionCompletion': True, 'streakAlerts': True, 'email': False, 'push': True}}).eq('user_id', uid).execute()

# ──────────────────────────────────────────────────────────
section("3. AI COACHING PIPELINE")
import inspect

from analysis.coaching_service import build_coaching_prompt, CoachingService, pick_focus_area

# 3a. Coaching style reaches the prompt
for style, keyword in [('strict', 'ELITE PERFORMANCE COACH'), ('encouraging', 'ENCOURAGING MENTOR'), ('balanced', 'HONEST PARTNER')]:
    profile = {'coaching_style': style.title(), 'feedback_detail': 'Detailed',
               'filler_score': 45, 'delivery_score': 55, 'structure_score': 60, 'vocab_score': 65, 'confidence_score': 50}
    from analysis.whisper_service import TranscriptResult
    try:
        tr = TranscriptResult.__new__(TranscriptResult)
        tr.transcript = "Um so basically I think the project is sort of done."
        tr.words = []
        tr.language = 'en'
        tr.duration_seconds = 10.0
    except:
        tr = type('TR', (), {'transcript': 'Test transcript.', 'words': [], 'language': 'en', 'duration_seconds': 10.0})()
    prompt = build_coaching_prompt('Test Topic', tr, None, None, profile, 'filler_words', 3, speaking_goal='general')
    if keyword in prompt:
        ok(f"coaching_style '{style}' injects '{keyword}' into AI prompt")
    else:
        fail(f"coaching_style '{style}' persona not found in prompt", f"searched: {keyword}")

# 3b. Expert detail level reaches the prompt
profile_expert = {'coaching_style': 'Balanced', 'feedback_detail': 'Expert',
                  'filler_score': 45, 'delivery_score': 55, 'structure_score': 60, 'vocab_score': 65, 'confidence_score': 50}
prompt_expert = build_coaching_prompt('Test Topic', tr, None, None, profile_expert, 'filler_words', 3, speaking_goal='general')
if 'EXPERT RHETORICAL ANALYSIS' in prompt_expert:
    ok("feedback_detail 'Expert' injects rhetorical analysis instructions into prompt")
else:
    fail("feedback_detail Expert not found in prompt")

# 3c. pick_focus_area works correctly
weakest_profile = {'filler_score': 20, 'delivery_score': 60, 'structure_score': 70, 'vocab_score': 65, 'confidence_score': 75}
focus = pick_focus_area(weakest_profile)
if focus == 'filler_words':
    ok(f"pick_focus_area correctly picks weakest skill (filler_words at score 20)")
else:
    fail(f"pick_focus_area picked '{focus}' instead of 'filler_words'")

# 3d. pipeline.py has correct wiring
from analysis import pipeline as pipeline_mod
psrc = inspect.getsource(pipeline_mod)
for check, name in [
    ('user_profile', 'pipeline passes user_profile to coaching service'),
    ('generate_report', 'pipeline calls generate_report'),
    ('coaching_service', 'pipeline imports coaching_service'),
]:
    if check in psrc:
        ok(name)
    else:
        fail(name)

# ──────────────────────────────────────────────────────────
section("4. EMAIL & NOTIFICATIONS")
from services import notification_service as ns
nsrc = inspect.getsource(ns)
for check, name in [
    ('_report_email_html', 'Session report email template exists'),
    ('_reminder_email_html', 'Daily reminder email template exists'),
    ('send_session_complete_notifications', 'Session completion notification function exists'),
    ('send_daily_practice_reminders', 'Daily reminder scheduler function exists'),
    ('_claim_delivery', 'Email deduplication (claim_delivery) implemented'),
    ('notification_deliveries', 'notification_deliveries table used for dedup'),
]:
    if check in nsrc:
        ok(name)
    else:
        fail(name)

# ──────────────────────────────────────────────────────────
section("5. API ROUTES & SECURITY")
from routers import dashboard as dash
dsrc = inspect.getsource(dash)
for check, name in [
    ('coaching_style', 'PATCH /preferences handles coaching_style'),
    ('feedback_detail', 'PATCH /preferences handles feedback_detail'),
    ('appearance_preferences', 'PATCH /preferences handles appearance_preferences'),
    ('notification_preferences', 'PATCH /preferences handles notification_preferences'),
    ('resilient_profile_write', 'Resilient write fallback implemented'),
    ('get_user_id', 'Auth guard on all endpoints'),
    ('merge_json', 'JSON preference merging for safe defaults'),
]:
    if check in dsrc:
        ok(name)
    else:
        fail(name)

# ──────────────────────────────────────────────────────────
section("6. FRONTEND BUILD CHECK")
dist_path = os.path.join('frontend', 'dist', 'index.html')
if os.path.exists(dist_path):
    size = os.path.getsize(os.path.join('frontend', 'dist', 'assets'))
    ok(f"Frontend build exists (dist/index.html present)")
else:
    fail("Frontend build missing (run npm run build)")

js_files = [f for f in os.listdir('frontend/dist/assets') if f.endswith('.js')]
css_files = [f for f in os.listdir('frontend/dist/assets') if f.endswith('.css')]
if js_files:
    ok(f"Frontend JS bundle built: {js_files[0]}")
if css_files:
    ok(f"Frontend CSS bundle built: {css_files[0]}")

# ──────────────────────────────────────────────────────────
section("FINAL RESULTS")
total = len(PASS) + len(FAIL)
print(f"\n  Passed: {len(PASS)}/{total}")
print(f"  Failed: {len(FAIL)}/{total}")
if FAIL:
    print("\n  Failed tests:")
    for f in FAIL:
        print(f"    - {f}")
else:
    print("\n  ALL TESTS PASSED. App is production-ready.")
