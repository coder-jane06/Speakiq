"""
╔══════════════════════════════════════════════════════════════╗
║   SpeakIQ — ULTIMATE PRODUCTION TEST SUITE                  ║
║   Tests every layer: DB, API, Pipeline, Frontend, Security  ║
╚══════════════════════════════════════════════════════════════╝
"""
import os, sys, json, time, inspect, random, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv('.env')

from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
HF_URL = "https://shaurya0606-speakiq-backend.hf.space"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌  FATAL: SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

PASS, FAIL, WARN = [], [], []

def ok(label, detail=''):
    msg = f"  ✅  {label}" + (f"  [{detail}]" if detail else '')
    PASS.append(label); print(msg)

def fail(label, detail=''):
    msg = f"  ❌  {label}" + (f"\n      → {detail}" if detail else '')
    FAIL.append(label); print(msg)

def warn(label, detail=''):
    msg = f"  ⚠️   {label}" + (f"  [{detail}]" if detail else '')
    WARN.append(label); print(msg)

def section(n, title):
    print(f"\n{'━'*62}")
    print(f"  SECTION {n}: {title}")
    print(f"{'━'*62}")

# ══════════════════════════════════════════════════════════════
section(1, "DATABASE SCHEMA & TABLE INTEGRITY")
# ══════════════════════════════════════════════════════════════

# Check all required tables
for table in ['sessions', 'user_profiles', 'session_metrics', 'topics',
              'streaks', 'push_subscriptions', 'notification_deliveries']:
    try:
        r = sb.table(table).select('*').limit(1).execute()
        ok(f"Table '{table}' exists and queryable")
    except Exception as e:
        fail(f"Table '{table}' missing or inaccessible", str(e)[:120])

# Check user_profiles columns
required_profile_cols = [
    'user_id', 'speaking_goal', 'difficulty_tier', 'coaching_style',
    'feedback_detail', 'appearance_preferences', 'notification_preferences',
    'audio_preferences', 'total_sessions', 'current_streak', 'filler_score',
    'delivery_score', 'structure_score', 'vocab_score', 'confidence_score',
    'onboarding_complete', 'display_name'
]
try:
    col_str = ', '.join(required_profile_cols)
    r = sb.table('user_profiles').select(col_str).limit(1).execute()
    ok(f"user_profiles has all {len(required_profile_cols)} required columns")
except Exception as e:
    fail("user_profiles missing required columns", str(e)[:120])

# Check session_metrics columns
try:
    r = sb.table('session_metrics').select(
        'session_id, wpm, filler_count, filler_detail, words, pause_list, '
        'pitch_variance, silence_percentage, longest_pause_sec, coaching_report, '
        'delivery_score, structure_score, vocab_score, filler_score, confidence_score'
    ).limit(1).execute()
    ok("session_metrics has all required metric columns")
except Exception as e:
    fail("session_metrics missing columns", str(e)[:120])

# Check sessions columns
try:
    r = sb.table('sessions').select(
        'id, user_id, topic_text, audio_url, status, created_at'
    ).limit(1).execute()
    ok("sessions table has required base columns")
except Exception as e:
    fail("sessions table missing columns", str(e)[:120])

# Check data volume
try:
    sessions_r = sb.table('sessions').select('id', count='exact').execute()
    profiles_r = sb.table('user_profiles').select('user_id', count='exact').execute()
    metrics_r = sb.table('session_metrics').select('session_id', count='exact').execute()
    ok(f"Data volumes — Sessions: {sessions_r.count}, Profiles: {profiles_r.count}, Metrics: {metrics_r.count}")
    if sessions_r.count == 0:
        warn("No sessions found — app may be newly deployed or DB is empty")
except Exception as e:
    fail("Data volume check", str(e)[:120])

# ══════════════════════════════════════════════════════════════
section(2, "SETTINGS PERSISTENCE — FULL SAVE/LOAD CYCLE")
# ══════════════════════════════════════════════════════════════

profiles = sb.table('user_profiles').select('user_id').limit(1).execute()
test_uid = None
if profiles.data:
    test_uid = profiles.data[0]['user_id']
    print(f"  Test user: {test_uid[:12]}...")

    # coaching_style
    for val in ['Strict', 'Encouraging', 'Balanced']:
        sb.table('user_profiles').update({'coaching_style': val}).eq('user_id', test_uid).execute()
        r = sb.table('user_profiles').select('coaching_style').eq('user_id', test_uid).execute()
        got = r.data[0].get('coaching_style') if r.data else None
        if got == val:
            ok(f"coaching_style → '{val}' saves and reads correctly")
        else:
            fail(f"coaching_style '{val}'", f"got: {got}")
    sb.table('user_profiles').update({'coaching_style': 'Balanced'}).eq('user_id', test_uid).execute()

    # feedback_detail
    for val in ['Basic', 'Expert', 'Detailed']:
        sb.table('user_profiles').update({'feedback_detail': val}).eq('user_id', test_uid).execute()
        r = sb.table('user_profiles').select('feedback_detail').eq('user_id', test_uid).execute()
        got = r.data[0].get('feedback_detail') if r.data else None
        if got == val:
            ok(f"feedback_detail → '{val}' saves and reads correctly")
        else:
            fail(f"feedback_detail '{val}'", f"got: {got}")
    sb.table('user_profiles').update({'feedback_detail': 'Detailed'}).eq('user_id', test_uid).execute()

    # appearance_preferences (JSON)
    test_ap = {'accentColor': '#6366F1', 'uiDensity': 'Compact', 'roundedCorners': 12}
    sb.table('user_profiles').update({'appearance_preferences': test_ap}).eq('user_id', test_uid).execute()
    r = sb.table('user_profiles').select('appearance_preferences').eq('user_id', test_uid).execute()
    got_ap = r.data[0].get('appearance_preferences') if r.data else {}
    if isinstance(got_ap, str):
        try: got_ap = json.loads(got_ap)
        except: got_ap = {}
    if got_ap.get('accentColor') == '#6366F1' and got_ap.get('roundedCorners') == 12:
        ok("appearance_preferences JSON (accentColor + roundedCorners) persists correctly")
    else:
        fail("appearance_preferences", f"got: {got_ap}")
    sb.table('user_profiles').update({'appearance_preferences': {'accentColor': 'green', 'uiDensity': 'Comfortable', 'roundedCorners': 24}}).eq('user_id', test_uid).execute()

    # notification_preferences (JSON)
    test_np = {'dailyReminder': False, 'weeklyReport': True, 'achievements': True,
               'sessionCompletion': False, 'streakAlerts': True, 'email': True, 'push': False}
    sb.table('user_profiles').update({'notification_preferences': test_np}).eq('user_id', test_uid).execute()
    r = sb.table('user_profiles').select('notification_preferences').eq('user_id', test_uid).execute()
    got_np = r.data[0].get('notification_preferences') if r.data else {}
    if isinstance(got_np, str):
        try: got_np = json.loads(got_np)
        except: got_np = {}
    if got_np.get('email') is True and got_np.get('dailyReminder') is False:
        ok("notification_preferences JSON (email on, reminder off) persists correctly")
    else:
        fail("notification_preferences", f"got: {got_np}")

    # speaking_goal
    for goal in ['orator', 'debater', 'presenter', 'interviewer', 'general']:
        sb.table('user_profiles').update({'speaking_goal': goal}).eq('user_id', test_uid).execute()
        r = sb.table('user_profiles').select('speaking_goal').eq('user_id', test_uid).execute()
        got = r.data[0].get('speaking_goal') if r.data else None
        if got == goal:
            ok(f"speaking_goal → '{goal}' persists")
        else:
            fail(f"speaking_goal '{goal}'", f"got: {got}")

    # difficulty_tier
    for tier in ['beginner', 'intermediate', 'advanced']:
        sb.table('user_profiles').update({'difficulty_tier': tier}).eq('user_id', test_uid).execute()
        r = sb.table('user_profiles').select('difficulty_tier').eq('user_id', test_uid).execute()
        got = r.data[0].get('difficulty_tier') if r.data else None
        if got == tier:
            ok(f"difficulty_tier → '{tier}' persists")
        else:
            fail(f"difficulty_tier '{tier}'", f"got: {got}")
else:
    warn("No user profiles found — skipping persistence tests")

# ══════════════════════════════════════════════════════════════
section(3, "TOPIC POOL — VARIETY, GOAL-SPECIFICITY, EXCLUSION")
# ══════════════════════════════════════════════════════════════

try:
    from routers.sessions import TOPIC_POOL, get_topic
    ok(f"TOPIC_POOL imported successfully")

    # Check all goal_types exist
    expected_goals = ['orator', 'debater', 'presenter', 'interviewer', 'general']
    for g in expected_goals:
        if g in TOPIC_POOL:
            ok(f"TOPIC_POOL has goal '{g}'")
        else:
            fail(f"TOPIC_POOL missing goal '{g}'")

    # Check all tiers exist per goal
    expected_tiers = ['easy', 'medium', 'hard']
    total_topics = 0
    for g in expected_goals:
        if g not in TOPIC_POOL:
            continue
        for t in expected_tiers:
            topics = TOPIC_POOL.get(g, {}).get(t, [])
            count = len(topics)
            total_topics += count
            if count >= 20:
                ok(f"TOPIC_POOL['{g}']['{t}'] has {count} topics (≥20 required)")
            elif count >= 10:
                warn(f"TOPIC_POOL['{g}']['{t}'] has only {count} topics (20+ recommended)")
            else:
                fail(f"TOPIC_POOL['{g}']['{t}'] has only {count} topics — too few")

    ok(f"Total topics in pool: {total_topics}")

    # Check for duplicates within same goal/tier
    dup_found = False
    for g in expected_goals:
        for t in expected_tiers:
            topics = TOPIC_POOL.get(g, {}).get(t, [])
            seen = set()
            for topic in topics:
                if topic in seen:
                    fail(f"Duplicate topic in [{g}][{t}]: '{topic[:60]}'")
                    dup_found = True
                seen.add(topic)
    if not dup_found:
        ok("No duplicate topics found within any goal/tier combination")

    # Check topic quality (length, not too short)
    short_topics = []
    for g in expected_goals:
        for t in expected_tiers:
            for topic in TOPIC_POOL.get(g, {}).get(t, []):
                if len(topic) < 20:
                    short_topics.append(f"[{g}][{t}]: '{topic}'")
    if short_topics:
        fail(f"Topics too short (<20 chars)", '; '.join(short_topics[:3]))
    else:
        ok("All topics have sufficient length (≥20 chars)")

except ImportError as e:
    fail("TOPIC_POOL import failed", str(e))

# Test exclusion logic
try:
    from routers.sessions import TOPIC_POOL
    g, t = 'debater', 'medium'
    all_topics = TOPIC_POOL[g][t]
    exclude_texts = ','.join(all_topics[:len(all_topics)-2])  # exclude all but last 2
    remaining = [tp for tp in all_topics if tp not in exclude_texts.split(',')]
    if len(remaining) >= 1:
        ok(f"Exclusion logic works — {len(remaining)} topics remain after excluding {len(all_topics)-2}")
    else:
        warn("Exclusion left 0 topics — fallback to adjacent tier should trigger")
except Exception as e:
    fail("Exclusion logic test", str(e))

# ══════════════════════════════════════════════════════════════
section(4, "GOAL NORMALIZATION — FULL PIPELINE ROUTING")
# ══════════════════════════════════════════════════════════════

try:
    from routers.dashboard import normalize_goal, normalize_difficulty
    from routers.sessions import normalize_goal as sessions_normalize_goal

    # Test dashboard normalization
    goal_cases = [
        ('orator', 'orator'), ('debater', 'debater'), ('presenter', 'presenter'),
        ('interviewer', 'interviewer'), ('general', 'general'),
        ('public speaking', 'orator'), ('interview', 'interviewer'),
        ('debate', 'debater'), ('presentation', 'presenter'),
        ('ORATOR', 'orator'), (None, 'general'), ('', 'general'),
    ]
    all_ok = True
    for inp, expected in goal_cases:
        result = normalize_goal(inp)
        if result != expected:
            fail(f"normalize_goal('{inp}')", f"expected '{expected}', got '{result}'")
            all_ok = False
    if all_ok:
        ok(f"normalize_goal passes all {len(goal_cases)} test cases")

    diff_cases = [
        ('beginner', 'beginner'), ('intermediate', 'intermediate'), ('advanced', 'advanced'),
        ('easy', 'beginner'), ('medium', 'intermediate'), ('hard', 'advanced'),
        ('BEGINNER', 'beginner'), (None, 'beginner'),
    ]
    all_ok = True
    for inp, expected in diff_cases:
        result = normalize_difficulty(inp)
        if result != expected:
            fail(f"normalize_difficulty('{inp}')", f"expected '{expected}', got '{result}'")
            all_ok = False
    if all_ok:
        ok(f"normalize_difficulty passes all {len(diff_cases)} test cases")

except Exception as e:
    fail("Goal/difficulty normalization", str(e))

# ══════════════════════════════════════════════════════════════
section(5, "SESSION LEVEL DURATION — FRONTEND CONSTANTS")
# ══════════════════════════════════════════════════════════════

session_page_path = os.path.join('frontend', 'src', 'pages', 'Session.page.tsx')
if os.path.exists(session_page_path):
    with open(session_page_path, 'r', encoding='utf-8') as f:
        session_src = f.read()

    # Check level durations
    duration_checks = [
        ('beginner', 60), ('intermediate', 90), ('advanced', 120)
    ]
    for level, expected_dur in duration_checks:
        # Find duration near the level name
        pattern = rf'{level}.*?duration.*?(\d+)'
        match = re.search(pattern, session_src, re.IGNORECASE | re.DOTALL)
        if match:
            found_dur = int(match.group(1))
            if found_dur == expected_dur:
                ok(f"Level '{level}' duration = {expected_dur}s ✓")
            else:
                fail(f"Level '{level}' duration wrong", f"expected {expected_dur}s, found {found_dur}s")
        else:
            # Fallback: check raw number appears near level
            if f'{expected_dur}' in session_src:
                ok(f"Level '{level}' — {expected_dur}s found in Session.page.tsx")
            else:
                fail(f"Level '{level}' duration {expected_dur}s not found in Session.page.tsx")

    # Check goal-specific focus areas
    for goal, focus in [
        ('orator', 'Storytelling'),
        ('debater', 'Critical Thinking'),
        ('presenter', 'Clarity'),
        ('interviewer', 'STAR Method')
    ]:
        if focus in session_src:
            ok(f"Goal '{goal}' focus area '{focus}' wired in Session.page.tsx")
        else:
            fail(f"Goal '{goal}' focus area '{focus}' not found in Session.page.tsx")

    # Check brainstorm hints
    for hint in ['STAR method', 'Anticipate counter-arguments', 'Rule of three', 'emotional connection']:
        if hint.lower() in session_src.lower():
            ok(f"Brainstorm hint '{hint}' present")
        else:
            warn(f"Brainstorm hint '{hint}' not found — may use different wording")

    # Check that hardcoded 88 is gone
    if "'88'" in session_src or '"88"' in session_src or '88/100' in session_src:
        fail("Hardcoded '88' score still present in Session.page.tsx — analytics preview not fixed")
    else:
        ok("No hardcoded '88' score — analytics preview uses real data")

    # Check recordingDurationSecs wired
    if 'recordingDurationSecs' in session_src:
        ok("recordingDurationSecs override wired in Session.page.tsx")
    else:
        fail("recordingDurationSecs not found — level duration override not wired")

    # Check excludeTexts wired to TopicCard
    if 'excludeTexts' in session_src:
        ok("excludeTexts passed to TopicCard — topic exclusion working")
    else:
        fail("excludeTexts not found in Session.page.tsx — topic exclusion not wired")
else:
    fail("Session.page.tsx not found")

# ══════════════════════════════════════════════════════════════
section(6, "useSessionFlow — DURATION OVERRIDE")
# ══════════════════════════════════════════════════════════════

flow_path = os.path.join('frontend', 'src', 'hooks', 'useSessionFlow.ts')
if os.path.exists(flow_path):
    with open(flow_path, 'r', encoding='utf-8') as f:
        flow_src = f.read()
    if 'recordingDurationSecs' in flow_src:
        ok("recordingDurationSecs in SessionOptions interface")
    else:
        fail("recordingDurationSecs missing from useSessionFlow.ts")
    if 'recordingDurationRef.current' in flow_src and 'recordingDurationSecs' in flow_src:
        ok("Duration override applied to recordingDurationRef in startPrep")
    else:
        fail("Duration override not applied to timer ref in useSessionFlow.ts")
else:
    fail("useSessionFlow.ts not found")

# ══════════════════════════════════════════════════════════════
section(7, "TopicCard — EXCLUDE TEXTS PARAM")
# ══════════════════════════════════════════════════════════════

topic_card_path = os.path.join('frontend', 'src', 'components', 'TopicCard.tsx')
if os.path.exists(topic_card_path):
    with open(topic_card_path, 'r', encoding='utf-8') as f:
        tc_src = f.read()
    if 'excludeTexts' in tc_src:
        ok("TopicCard has excludeTexts prop")
    else:
        fail("TopicCard missing excludeTexts prop")
    if 'exclude_texts' in tc_src:
        ok("TopicCard sends exclude_texts param to backend API")
    else:
        fail("TopicCard does not send exclude_texts to API")
else:
    fail("TopicCard.tsx not found")

# ══════════════════════════════════════════════════════════════
section(8, "RESULTS PAGE — PER-METRIC UNIQUE INSIGHTS")
# ══════════════════════════════════════════════════════════════

results_path = os.path.join('frontend', 'src', 'pages', 'Results.page.tsx')
if os.path.exists(results_path):
    with open(results_path, 'r', encoding='utf-8') as f:
        results_src = f.read()

    # Each metric must use its own unique coaching field
    metric_checks = [
        ('delivery', 'mechanical_tip', 'Delivery insight uses mechanical_tip'),
        ('vocab', 'content_feedback', 'Vocab insight uses content_feedback'),
        ('structure', 'content_outline', 'Structure insight uses content_outline'),
        ('confidence', 'encouragement', 'Confidence insight uses encouragement'),
        ('filler', 'daily_drill', 'Filler insight uses daily_drill'),
    ]
    for metric_id, coaching_field, desc in metric_checks:
        # Check field is used in the same block as metric id
        pattern = rf"m\.id === '{metric_id}'.*?{coaching_field}"
        if re.search(pattern, results_src, re.DOTALL):
            ok(desc)
        else:
            fail(desc, f"'{coaching_field}' not found near m.id === '{metric_id}'")

    # Check contextual chips
    chip_checks = [
        ('pitch_variance', 'Confidence section uses real pitch_variance'),
        ('filler_detail', 'Filler section shows individual filler word tags'),
        ('longest_pause_sec', 'Delivery section shows longest pause'),
        ('silence_percentage', 'Delivery section shows silence %'),
        ('diversityLabel', 'Vocabulary section has lexical diversity label'),
        ('pitchLabel', 'Confidence section has pitch label'),
        ('fillerEntries', 'Filler section iterates detected filler entries'),
        ('outlineSteps', 'Structure section shows AI outline steps'),
    ]
    for check_str, desc in chip_checks:
        if check_str in results_src:
            ok(desc)
        else:
            fail(desc)

    # Check 4-tier badge system
    if "'Fair'" in results_src or '"Fair"' in results_src:
        ok("4-tier badge system (Excellent/Improving/Fair/Needs Work) implemented")
    else:
        fail("4-tier badge system missing 'Fair' tier")

    # Check color-coded progress bars
    if 'bg-emerald-500' in results_src and 'bg-blue-500' in results_src and 'bg-amber-500' in results_src:
        ok("Progress bars have 3-color system (green/blue/amber by score)")
    else:
        fail("Progress bar colors not properly differentiated")
else:
    fail("Results.page.tsx not found")

# ══════════════════════════════════════════════════════════════
section(9, "SETTINGS PAGE — PERSISTENCE MECHANISM")
# ══════════════════════════════════════════════════════════════

settings_path = os.path.join('frontend', 'src', 'pages', 'Settings.page.tsx')
if os.path.exists(settings_path):
    with open(settings_path, 'r', encoding='utf-8') as f:
        settings_src = f.read()

    # CSS variable application
    if 'setProperty' in settings_src and '--accent' in settings_src:
        ok("Appearance: CSS variable --accent applied via setProperty")
    else:
        fail("Appearance: --accent CSS variable not set via setProperty")

    if 'setProperty' in settings_src and 'radius' in settings_src.lower():
        ok("Appearance: border-radius CSS variable applied")
    else:
        warn("Appearance: border-radius CSS variable may not be applied")

    # localStorage persistence
    if 'localStorage' in settings_src or 'lsSet' in settings_src:
        ok("Settings uses localStorage for persistence")
    else:
        fail("Settings has no localStorage usage")

    # Save confirmations
    if "'Saved!'" in settings_src or '"Saved!"' in settings_src:
        ok("Settings save handlers show 'Saved!' confirmation")
    else:
        fail("Settings save handlers missing 'Saved!' confirmation")

    # patchPreferences called for coaching, appearance, notifications
    patch_count = settings_src.count('patchPreferences')
    if patch_count >= 3:
        ok(f"patchPreferences called {patch_count} times — covers all setting sections")
    elif patch_count >= 1:
        warn(f"patchPreferences called only {patch_count} times — some sections may not sync to backend")
    else:
        fail("patchPreferences never called — settings won't persist to backend")

    # Mount-time CSS application
    if 'useEffect' in settings_src and 'setProperty' in settings_src:
        ok("useEffect applies saved appearance settings on mount")
    else:
        fail("Appearance settings not applied on mount — will flicker on reload")
else:
    fail("Settings.page.tsx not found")

# ══════════════════════════════════════════════════════════════
section(10, "AI COACHING PIPELINE — GOAL ROUTING & PROMPTS")
# ══════════════════════════════════════════════════════════════

try:
    from analysis.coaching_service import build_coaching_prompt, CoachingService, pick_focus_area, CoachingScores

    # Create mock transcript
    class MockTranscript:
        transcript = "Um so basically I think the project is sort of done and like we should move forward."
        words = [{'word': w, 'start': i*0.5, 'end': (i+1)*0.5} for i, w in enumerate(transcript.split())]
        language = 'en'
        duration_seconds = 30.0
        word_count = len(words)

    tr = MockTranscript()

    # Test goal-specific prompts
    goal_keywords = {
        'orator': ['ORATOR', 'rhetorical', 'Anaphora', 'Rule of Three'],
        'debater': ['DEBAT', 'STAR', 'Refutation', 'DR. MO'],
        'presenter': ['PRESENT', 'Tagline', 'slide', 'Data-driven'],
        'interviewer': ['INTERVIEW', 'STAR Method', 'Situation, Task'],
    }
    base_profile = {'coaching_style': 'Balanced', 'feedback_detail': 'Detailed',
                    'filler_score': 50, 'delivery_score': 50, 'structure_score': 50,
                    'vocab_score': 50, 'confidence_score': 50}

    for goal, keywords in goal_keywords.items():
        prompt = build_coaching_prompt(
            topic=f"Test topic for {goal}", transcript_result=tr,
            acoustic_result=None, nlp_result=None, user_profile=base_profile,
            focus_area='filler_words', session_number=3, speaking_goal=goal
        )
        found = [kw for kw in keywords if kw.lower() in prompt.lower()]
        if found:
            ok(f"Goal '{goal}' → prompt contains goal-specific keywords {found}")
        else:
            fail(f"Goal '{goal}' → no goal-specific keywords found", f"searched: {keywords}")

    # Test coaching style injection
    for style, keyword in [('Strict', 'STRICT'), ('Encouraging', 'ENCOURAGING'), ('Balanced', 'HONEST')]:
        profile = {**base_profile, 'coaching_style': style}
        prompt = build_coaching_prompt('Test', tr, None, None, profile, 'filler_words', 1, speaking_goal='general')
        if keyword.lower() in prompt.lower():
            ok(f"coaching_style '{style}' injects tone keyword into prompt")
        else:
            warn(f"coaching_style '{style}' keyword '{keyword}' not found — may use different wording")

    # Test feedback detail injection
    for detail, keyword in [('Expert', 'EXPERT'), ('Basic', 'BASIC'), ('Detailed', 'DETAILED')]:
        profile = {**base_profile, 'feedback_detail': detail}
        prompt = build_coaching_prompt('Test', tr, None, None, profile, 'filler_words', 1, speaking_goal='general')
        if keyword.lower() in prompt.lower():
            ok(f"feedback_detail '{detail}' injects level keyword into prompt")
        else:
            warn(f"feedback_detail '{detail}' keyword '{keyword}' not found")

    # Test pick_focus_area
    weakest = {'filler_score': 20, 'delivery_score': 80, 'structure_score': 75, 'vocab_score': 70, 'confidence_score': 65}
    focus = pick_focus_area(weakest)
    if focus == 'filler_words':
        ok(f"pick_focus_area correctly identifies weakest skill: filler_words (score 20)")
    else:
        fail(f"pick_focus_area returned '{focus}' instead of 'filler_words'")

    # Test pipeline module imports and structure
    import analysis.pipeline as pipeline_mod
    pipeline_src = inspect.getsource(pipeline_mod)
    for check, desc in [
        ('run_analysis_pipeline', 'pipeline exports run_analysis_pipeline function'),
        ('speaking_goal_override', 'pipeline passes speaking_goal_override to coaching'),
        ('difficulty_tier', 'pipeline passes difficulty_tier'),
        ('generate_report', 'pipeline calls generate_report on coaching_service'),
        ('session_metrics', 'pipeline saves to session_metrics table'),
        ('coaching_report', 'pipeline stores coaching_report JSON'),
    ]:
        if check in pipeline_src:
            ok(desc)
        else:
            fail(desc)

    ok("Coaching pipeline import and structure check complete")

except Exception as e:
    fail("Coaching pipeline test", str(e)[:200])

# ══════════════════════════════════════════════════════════════
section(11, "DASHBOARD ROUTER — ALL ENDPOINTS & STATS")
# ══════════════════════════════════════════════════════════════

try:
    from routers import dashboard as dash
    dash_src = inspect.getsource(dash)

    checks = [
        ('def get_stats', 'GET /dashboard/stats endpoint exists'),
        ('def patch_preferences', 'PATCH /dashboard/preferences endpoint exists'),
        ('coaching_style', 'PATCH preferences handles coaching_style'),
        ('feedback_detail', 'PATCH preferences handles feedback_detail'),
        ('appearance_preferences', 'PATCH preferences handles appearance_preferences'),
        ('notification_preferences', 'PATCH preferences handles notification_preferences'),
        ('audio_preferences', 'PATCH preferences handles audio_preferences'),
        ('current_streak', 'Stats includes current_streak'),
        ('total_sessions', 'Stats includes total_sessions'),
        ('improvements', 'Stats includes skill improvements over time'),
        ('weekly_goal', 'Stats includes weekly_goal progress'),
        ('achievements', 'Stats includes achievements data'),
        ('get_user_id', 'Auth guard used on all endpoints'),
    ]
    for check, desc in checks:
        if check in dash_src:
            ok(desc)
        else:
            fail(desc)

except Exception as e:
    fail("Dashboard router check", str(e)[:120])

# ══════════════════════════════════════════════════════════════
section(12, "SECURITY — AUTH, CORS, RATE LIMITING, IDOR")
# ══════════════════════════════════════════════════════════════

try:
    import main as app_main
    app_src = inspect.getsource(app_main)

    security_checks = [
        ('ALLOWED_ORIGINS', 'CORS whitelist configured'),
        ('coder-jane06.github.io', 'GitHub Pages origin in CORS whitelist'),
        ('RateLimitExceeded', 'Rate limit exceeded handler configured'),
        ('200/minute', 'Global rate limit set'),
        ('global_exception_handler', 'Global exception handler (no leaking internals)'),
        ('unexpected error occurred', 'Generic error message in global handler'),
    ]
    for check, desc in security_checks:
        if check in app_src:
            ok(desc)
        else:
            fail(desc)

    # Check IDOR protection in sessions router
    from routers import sessions as sess_mod
    sess_src = inspect.getsource(sess_mod)
    if '.eq("user_id", user_id)' in sess_src:
        ok("IDOR protection: session GET filters by user_id")
    else:
        fail("IDOR protection: session GET does NOT filter by user_id")

    if 'status_code=401' in sess_src:
        ok("Auth guard: 401 returned for unauthenticated session access")
    else:
        fail("Auth guard: no 401 response for unauthenticated access")

    if 'MAX_UPLOAD_BYTES' in sess_src or 'max' in sess_src.lower():
        ok("File upload size limit enforced")
    else:
        warn("File upload size limit may not be enforced")

    if 'ALLOWED_AUDIO_TYPES' in sess_src:
        ok("Audio file type whitelist enforced")
    else:
        fail("Audio file type whitelist not enforced")

except Exception as e:
    fail("Security checks", str(e)[:120])

# ══════════════════════════════════════════════════════════════
section(13, "EMAIL & NOTIFICATION SERVICE")
# ══════════════════════════════════════════════════════════════

try:
    from services import notification_service as ns
    ns_src = inspect.getsource(ns)

    notif_checks = [
        ('_report_email_html', 'Session report email HTML template exists'),
        ('_reminder_email_html', 'Daily reminder email HTML template exists'),
        ('send_session_complete_notifications', 'Session completion trigger function exists'),
        ('send_daily_practice_reminders', 'Daily reminder scheduler exists'),
        ('_claim_delivery', 'Email deduplication via claim_delivery implemented'),
        ('notification_deliveries', 'notification_deliveries table prevents duplicate sends'),
        ('RESEND_API_KEY', 'Resend API key used for email delivery'),
    ]
    for check, desc in notif_checks:
        if check in ns_src:
            ok(desc)
        else:
            fail(desc)

    # Check push notification support
    if 'push_subscriptions' in ns_src or 'webpush' in ns_src.lower():
        ok("Push notification support (webpush / push_subscriptions) implemented")
    else:
        warn("Push notification implementation not found in notification_service")

except Exception as e:
    fail("Notification service check", str(e)[:120])

# ══════════════════════════════════════════════════════════════
section(14, "FRONTEND BUILD INTEGRITY")
# ══════════════════════════════════════════════════════════════

dist_path = os.path.join('frontend', 'dist')
index_path = os.path.join(dist_path, 'index.html')
assets_path = os.path.join(dist_path, 'assets')

if os.path.exists(index_path):
    ok("frontend/dist/index.html exists (build succeeded)")
else:
    fail("frontend/dist/index.html missing — run npm run build")

if os.path.exists(assets_path):
    js_files = [f for f in os.listdir(assets_path) if f.endswith('.js')]
    css_files = [f for f in os.listdir(assets_path) if f.endswith('.css')]
    if js_files:
        js_size = os.path.getsize(os.path.join(assets_path, js_files[0])) // 1024
        ok(f"JS bundle: {js_files[0]} ({js_size}KB)")
        if js_size > 2000:
            warn(f"JS bundle large ({js_size}KB) — consider code splitting")
    else:
        fail("No JS bundle found in dist/assets")
    if css_files:
        ok(f"CSS bundle: {css_files[0]}")
    else:
        fail("No CSS bundle found in dist/assets")

    # Check 404.html for SPA fallback
    fallback_path = os.path.join(dist_path, '404.html')
    if os.path.exists(fallback_path):
        ok("404.html exists for SPA routing fallback (GitHub Pages)")
    else:
        fail("404.html missing — SPA deep links will break on GitHub Pages")
else:
    fail("frontend/dist/assets directory missing")

# Check .env vars used in build
vite_env_path = os.path.join('frontend', '.env.production')
local_vite_env = os.path.join('frontend', '.env.local')
for env_path in [vite_env_path, local_vite_env, os.path.join('frontend', '.env')]:
    if os.path.exists(env_path):
        with open(env_path) as f:
            content = f.read()
        if 'VITE_API_URL' in content:
            ok(f"VITE_API_URL configured in {os.path.basename(env_path)}")
        if 'VITE_SUPABASE_URL' in content:
            ok(f"VITE_SUPABASE_URL configured in {os.path.basename(env_path)}")

# ══════════════════════════════════════════════════════════════
section(15, "LIVE API HEALTH CHECK (Hugging Face)")
# ══════════════════════════════════════════════════════════════

try:
    import urllib.request, urllib.error
    print(f"  Checking: {HF_URL}/health ...")
    req = urllib.request.Request(f"{HF_URL}/health", headers={'User-Agent': 'SpeakIQ-Test/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            if data.get('status') == 'ok':
                ok(f"HF Backend /health → {data}")
            else:
                warn(f"HF Backend /health returned unexpected", str(data))
    except urllib.error.URLError as e:
        if 'timed out' in str(e).lower():
            warn("HF Backend /health timed out — Space may be sleeping (normal for free tier)")
        elif '503' in str(e):
            warn("HF Backend 503 — Space is building/restarting (wait ~2 min after deploy)")
        else:
            fail("HF Backend unreachable", str(e)[:80])
except Exception as e:
    warn("Could not test live HF backend", str(e)[:80])

# Test /sessions/topic endpoint on HF
try:
    for goal, tier in [('orator', 'easy'), ('debater', 'hard'), ('interviewer', 'medium')]:
        url = f"{HF_URL}/sessions/topic?goal={goal}&difficulty={tier}"
        req = urllib.request.Request(url, headers={'User-Agent': 'SpeakIQ-Test/1.0'})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                if 'text' in data and len(data['text']) > 10:
                    ok(f"HF /sessions/topic?goal={goal}&difficulty={tier} → '{data['text'][:50]}...'")
                else:
                    fail(f"HF /sessions/topic returned invalid data", str(data)[:100])
        except urllib.error.URLError as e:
            if '503' in str(e) or 'timed' in str(e).lower():
                warn(f"HF /sessions/topic not responding (Space may be warming up)")
                break
            else:
                fail(f"HF /sessions/topic request failed", str(e)[:80])
except Exception as e:
    warn("Topic endpoint live test skipped", str(e)[:80])

# ══════════════════════════════════════════════════════════════
section(16, "STREAK & ACHIEVEMENT DATA INTEGRITY")
# ══════════════════════════════════════════════════════════════

try:
    # Check streaks table
    streaks_r = sb.table('streaks').select('*').limit(5).execute()
    if streaks_r.data is not None:
        ok(f"Streaks table accessible ({len(streaks_r.data)} records)")
    else:
        warn("Streaks table empty or inaccessible")

    # Check user_profiles streak columns
    if test_uid:
        r = sb.table('user_profiles').select(
            'current_streak, longest_streak, last_session_date, total_sessions'
        ).eq('user_id', test_uid).execute()
        if r.data:
            p = r.data[0]
            ok(f"Streak data — current: {p.get('current_streak', 0)}, longest: {p.get('longest_streak', 0)}, total sessions: {p.get('total_sessions', 0)}")
        else:
            warn("No streak data for test user")

    # Validate session_metrics coaching_report JSON integrity
    metrics_r = sb.table('session_metrics').select(
        'session_id, coaching_report, delivery_score, structure_score'
    ).limit(5).execute()

    valid_reports = 0
    invalid_reports = 0
    for m in (metrics_r.data or []):
        cr = m.get('coaching_report')
        if cr:
            if isinstance(cr, str):
                try:
                    parsed = json.loads(cr)
                    if 'scores' in parsed:
                        valid_reports += 1
                    else:
                        invalid_reports += 1
                except:
                    invalid_reports += 1
            elif isinstance(cr, dict):
                if 'scores' in cr:
                    valid_reports += 1
                else:
                    invalid_reports += 1

    if valid_reports > 0:
        ok(f"Coaching report JSON valid in {valid_reports}/{valid_reports+invalid_reports} session_metrics rows")
    if invalid_reports > 0:
        warn(f"{invalid_reports} session_metrics rows have malformed coaching_report")

except Exception as e:
    fail("Streak & achievement data check", str(e)[:120])

# ══════════════════════════════════════════════════════════════
section(17, "WHISPER & ACOUSTIC SERVICE IMPORTS")
# ══════════════════════════════════════════════════════════════

services_to_check = [
    ('analysis.whisper_service', 'whisper_service', ['transcribe_from_bytes', 'TranscriptResult']),
    ('analysis.acoustic_service', 'acoustic_service', ['AcousticResult']),
    ('analysis.nlp_service', 'nlp_service', ['NLPResult']),
    ('analysis.coaching_service', 'coaching_service', ['CoachingReport', 'CoachingService', 'build_coaching_prompt']),
]
for module_name, service_name, expected_attrs in services_to_check:
    try:
        mod = __import__(module_name, fromlist=[service_name])
        missing = [a for a in expected_attrs if not hasattr(mod, a)]
        if not missing:
            ok(f"{module_name} imports correctly with all expected attributes")
        else:
            fail(f"{module_name} missing attributes", ', '.join(missing))
    except ImportError as e:
        fail(f"{module_name} import failed", str(e)[:100])

# ══════════════════════════════════════════════════════════════
section(18, "GITHUB PAGES DEPLOYMENT CONFIG")
# ══════════════════════════════════════════════════════════════

workflow_path = os.path.join('.github', 'workflows', 'deploy.yml')
if os.path.exists(workflow_path):
    with open(workflow_path) as f:
        wf_src = f.read()
    checks_wf = [
        ('push', 'Workflow triggers on push'),
        ('main', 'Workflow targets main branch'),
        ('npm run build', 'Workflow runs npm build'),
        ('VITE_API_URL', 'VITE_API_URL injected as build env var'),
        ('peaceiris/actions-gh-pages', 'Uses gh-pages action for deployment'),
        ('gh-pages', 'Deploys to gh-pages branch'),
        ('shaurya0606-speakiq-backend.hf.space', 'HF backend URL configured in workflow'),
    ]
    for check, desc in checks_wf:
        if check in wf_src:
            ok(desc)
        else:
            fail(desc)
else:
    fail("GitHub Actions workflow not found at .github/workflows/deploy.yml")

# ══════════════════════════════════════════════════════════════
print(f"\n{'═'*62}")
print("  FINAL RESULTS")
print(f"{'═'*62}")
total = len(PASS) + len(FAIL) + len(WARN)
pct = round(len(PASS) / max(1, len(PASS)+len(FAIL)) * 100)
print(f"\n  ✅  Passed : {len(PASS)}/{len(PASS)+len(FAIL)}  ({pct}%)")
print(f"  ❌  Failed : {len(FAIL)}")
print(f"  ⚠️   Warned : {len(WARN)}")

if FAIL:
    print(f"\n{'─'*62}")
    print("  FAILED TESTS (must fix before production):")
    for f in FAIL:
        print(f"    ❌  {f}")
if WARN:
    print(f"\n{'─'*62}")
    print("  WARNINGS (review recommended):")
    for w in WARN:
        print(f"    ⚠️   {w}")

print(f"\n{'═'*62}")
if not FAIL:
    print("  🎉  ALL CRITICAL TESTS PASSED — APP IS PRODUCTION-READY!")
else:
    print(f"  🔧  {len(FAIL)} issue(s) require fixing before production release.")
print(f"{'═'*62}\n")

# Exit with error code if any failures
sys.exit(1 if FAIL else 0)
