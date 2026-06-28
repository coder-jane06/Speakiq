"""
SpeakIQ — Deep App Audit Script
Tests every page and data flow end-to-end.
"""

import asyncio
import json
import sys
import os
from playwright.async_api import async_playwright, Page, expect

FRONTEND = "https://localhost:5174/Speakiq"
BACKEND  = "http://127.0.0.1:8002"

# ── We'll log in with the test account ──────────────────────────
# Read creds from env or use known test account
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY", "")

issues = []
passed = []

def ok(msg):
    passed.append(msg)
    print(f"  PASS  {msg}")

def fail(msg):
    issues.append(msg)
    print(f"  FAIL  {msg}")

def info(msg):
    print(f"  ....  {msg}")


async def audit_backend_directly():
    """Test backend APIs directly without a browser."""
    import urllib.request

    info("Testing backend endpoints directly...")

    tests = [
        ("/health",                   200, "Health check"),
        ("/sessions/topic",           200, "Topic endpoint returns topic"),
        ("/dashboard/stats",          200, "Stats returns empty state when unauth"),
        ("/dashboard/streak",         200, "Streak returns empty state when unauth"),
        ("/dashboard/profile-status", 200, "Profile-status works when unauth"),
        ("/sessions/",                401, "Sessions list requires auth (security)"),
    ]

    for path, want_code, desc in tests:
        try:
            req = urllib.request.Request(BACKEND + path)
            resp = urllib.request.urlopen(req, timeout=6)
            code = resp.status
            body = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            code = e.code
            try: body = json.loads(e.read())
            except: body = {}
        except Exception as e:
            code = 0
            body = {}

        if code == want_code:
            ok(f"{desc} [{path}] -> {code}")
        else:
            fail(f"{desc} [{path}] -> got {code}, want {want_code}")

    # Check topic has proper fields
    try:
        req = urllib.request.Request(BACKEND + "/sessions/topic")
        body = json.loads(urllib.request.urlopen(req, timeout=6).read())
        has_text      = bool(body.get("text"))
        has_tier      = body.get("tier") in ("easy","medium","hard")
        has_goal_type = body.get("goal_type") in ("general","orator","debater","presenter","interviewer")
        has_skill     = bool(body.get("target_skill"))
        if has_text:      ok(f"Topic has text: '{body['text'][:50]}'")
        else:             fail("Topic missing text")
        if has_tier:      ok(f"Topic has valid tier: {body['tier']}")
        else:             fail(f"Topic has bad tier: {body.get('tier')}")
        if has_goal_type: ok(f"Topic has goal_type: {body['goal_type']}")
        else:             fail(f"Topic has bad goal_type: {body.get('goal_type')}")
        if has_skill:     ok(f"Topic has target_skill: {body['target_skill']}")
        else:             fail(f"Topic missing target_skill")
    except Exception as e:
        fail(f"Topic field check failed: {e}")


async def audit_database():
    """Check Supabase tables have correct structure."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import get_db
    db = get_db()

    info("Auditing Supabase tables...")

    # Tables that must exist
    required_tables = {
        "sessions":          ["id","user_id","topic_text","status","created_at"],
        "session_metrics":   ["id","session_id","transcript","wpm","filler_count","coaching_report"],
        "user_profiles":     ["id","user_id","filler_score","speaking_goal","difficulty_tier","onboarding_complete","recording_duration_secs"],
        "topics":            ["id","text","tier","category","target_skill","goal_type"],
        "streaks":           ["id","user_id","current_streak","total_sessions"],
        "session_summaries": ["id","user_id","session_id","summary_text","scores","drill_given","drill_completed"],
        "drill_completions": ["id","user_id","drill_text","drill_type"],
        "daily_completions": ["id","user_id","completed_date"],
    }

    for table, required_cols in required_tables.items():
        try:
            r = db.table(table).select(",".join(required_cols)).limit(1).execute()
            count_r = db.table(table).select("*", count="exact").limit(0).execute()
            ok(f"Table '{table}' exists ({count_r.count} rows), all required columns present")
        except Exception as e:
            fail(f"Table '{table}' issue: {str(e)[:80]}")

    # Check topics are properly seeded with goal types
    try:
        r = db.table("topics").select("goal_type").execute()
        counts = {}
        for row in r.data:
            g = row.get("goal_type", "?")
            counts[g] = counts.get(g, 0) + 1
        total = sum(counts.values())
        if total >= 60:
            ok(f"Topics seeded: {total} total — {counts}")
        else:
            fail(f"Too few topics: {total} (want >=60) — {counts}")
    except Exception as e:
        fail(f"Topic count check failed: {e}")

    # Check coaching_report is stored correctly in recent sessions
    try:
        r = db.table("session_metrics").select("session_id,coaching_report").order("created_at", desc=True).limit(3).execute()
        for row in r.data:
            cr = row.get("coaching_report")
            if cr:
                data = json.loads(cr) if isinstance(cr, str) else cr
                has_scores = "scores" in data
                has_drill  = "daily_drill" in data
                has_fix    = "priority_fix" in data
                if has_scores and has_drill and has_fix:
                    ok(f"session_metrics coaching_report valid for session {row['session_id'][:8]}")
                else:
                    missing = [k for k,v in {"scores":has_scores,"daily_drill":has_drill,"priority_fix":has_fix}.items() if not v]
                    fail(f"session_metrics coaching_report missing: {missing} for {row['session_id'][:8]}")
            else:
                fail(f"session_metrics has null coaching_report for {row['session_id'][:8]}")
    except Exception as e:
        fail(f"Coaching report check failed: {e}")


async def audit_frontend_pages(page: Page):
    """Visit every page and check for JS errors and key UI elements."""

    info("Auditing frontend pages...")

    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)))
    page.on("console", lambda msg: js_errors.append(msg.text) if msg.type == "error" else None)

    # 1. Home page
    try:
        await page.goto(FRONTEND + "/", wait_until="networkidle", timeout=15000)
        title = await page.title()
        has_start_btn = await page.locator("button:has-text('Start Session')").count() > 0
        if has_start_btn: ok("Home page: 'Start Session' button present")
        else:             fail("Home page: 'Start Session' button MISSING")

        has_features = await page.locator("text=AI Analysis").count() > 0
        if has_features: ok("Home page: Feature cards visible")
        else:            fail("Home page: Feature cards MISSING")
    except Exception as e:
        fail(f"Home page load failed: {e}")

    # 2. Login page
    try:
        await page.goto(FRONTEND + "/login", wait_until="networkidle", timeout=15000)
        has_email = await page.locator("input[type='email'], input[placeholder*='email' i]").count() > 0
        has_pass  = await page.locator("input[type='password']").count() > 0
        if has_email: ok("Login page: email input present")
        else:         fail("Login page: email input MISSING")
        if has_pass:  ok("Login page: password input present")
        else:         fail("Login page: password input MISSING")
    except Exception as e:
        fail(f"Login page load failed: {e}")

    # 3. Dashboard page (unauthenticated — should redirect or show empty)
    try:
        await page.goto(FRONTEND + "/dashboard", wait_until="networkidle", timeout=15000)
        url_after = page.url
        # Either redirected to login or shows dashboard with empty state
        if "/login" in url_after or "/dashboard" in url_after:
            ok(f"Dashboard page: navigates correctly -> {url_after.split('/')[-1]}")
        else:
            fail(f"Dashboard page: unexpected redirect -> {url_after}")
    except Exception as e:
        fail(f"Dashboard page load failed: {e}")

    # 4. Profile page
    try:
        await page.goto(FRONTEND + "/profile", wait_until="networkidle", timeout=15000)
        url_after = page.url
        if "/login" in url_after or "/profile" in url_after:
            ok(f"Profile page: navigates correctly -> {url_after.split('/')[-1]}")
        else:
            fail(f"Profile page: unexpected redirect -> {url_after}")
    except Exception as e:
        fail(f"Profile page load failed: {e}")

    # 5. Onboarding page
    try:
        await page.goto(FRONTEND + "/onboarding", wait_until="networkidle", timeout=15000)
        url_after = page.url
        on_onboarding = "/onboarding" in url_after or "/login" in url_after
        if on_onboarding:
            ok(f"Onboarding page: loads -> {url_after.split('/')[-1]}")
        else:
            fail(f"Onboarding page: unexpected URL -> {url_after}")
    except Exception as e:
        fail(f"Onboarding page load failed: {e}")

    # 6. 404 / unknown route
    try:
        await page.goto(FRONTEND + "/nonexistent-route-xyz", wait_until="networkidle", timeout=10000)
        # Should not crash
        ok("404 route: app handles unknown route without crash")
    except Exception as e:
        fail(f"404 route crashed: {e}")

    # Report JS console errors (filter out known benign ones)
    real_errors = [e for e in js_errors if not any(skip in e for skip in [
        "favicon", "hot-reload", "vite", "ResizeObserver",
        "Non-Error promise", "__REACT_DEVTOOLS"
    ])]
    if real_errors:
        for e in real_errors[:5]:
            fail(f"JS console error: {e[:100]}")
    else:
        ok("No JavaScript console errors on any page")


async def audit_session_endpoint():
    """Check the session/results polling endpoint works for a real session."""
    import urllib.request
    from config import get_db
    db = get_db()

    info("Checking session results endpoint...")

    try:
        # Get the most recent complete session
        r = db.table("sessions").select("id,status,topic_text").eq("status","complete").order("created_at",desc=True).limit(1).execute()
        if not r.data:
            info("No completed sessions yet — skipping session endpoint test")
            return

        session = r.data[0]
        sid = session["id"]

        req = urllib.request.Request(f"{BACKEND}/sessions/{sid}")
        resp = urllib.request.urlopen(req, timeout=6)
        body = json.loads(resp.read())

        metrics = body.get("session_metrics", [])
        if isinstance(metrics, dict): metrics = [metrics]

        if metrics and metrics[0].get("coaching_report"):
            cr = metrics[0]["coaching_report"]
            if isinstance(cr, str): cr = json.loads(cr)
            required = ["scores","what_went_well","priority_fix","daily_drill","mechanical_tip","micro_habit"]
            missing = [k for k in required if not cr.get(k)]
            if not missing:
                ok(f"Session result endpoint: all coaching fields present for {sid[:8]}")
            else:
                fail(f"Session result missing fields: {missing}")

            scores = cr.get("scores", {})
            score_keys = {"filler","delivery","structure","vocab","confidence"}
            has_all_scores = score_keys <= set(scores.keys())
            all_in_range   = all(0 <= v <= 100 for v in scores.values() if isinstance(v,(int,float)))
            if has_all_scores: ok(f"Scores have all 5 dimensions: {scores}")
            else:              fail(f"Scores missing keys: {score_keys - set(scores.keys())}")
            if all_in_range:   ok("All scores in valid range 0-100")
            else:              fail(f"Score out of range: {scores}")
        else:
            fail(f"Session {sid[:8]} has no coaching_report in metrics")

    except Exception as e:
        fail(f"Session endpoint audit failed: {e}")


async def main():
    print()
    print("=" * 60)
    print("SPEAKIQ DEEP APP AUDIT")
    print("=" * 60)
    print()

    # 1. Backend API tests
    print("[ BACKEND APIs ]")
    await audit_backend_directly()

    # 2. Database integrity
    print()
    print("[ DATABASE INTEGRITY ]")
    await audit_database()

    # 3. Session/results endpoint
    print()
    print("[ SESSION RESULTS ENDPOINT ]")
    await audit_session_endpoint()

    # 4. Frontend page tests
    print()
    print("[ FRONTEND PAGES ]")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            ignore_default_args=["--disable-extensions"],
            args=["--ignore-certificate-errors"]  # for localhost https
        )
        ctx = await browser.new_context(ignore_https_errors=True)
        page = await ctx.new_page()
        await audit_frontend_pages(page)
        await browser.close()

    # Final report
    print()
    print("=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    print(f"  Passed : {len(passed)}")
    print(f"  Failed : {len(issues)}")
    if issues:
        print()
        print("  ISSUES TO FIX:")
        for i, iss in enumerate(issues, 1):
            print(f"    {i}. {iss}")
    else:
        print()
        print("  ALL CHECKS PASSED - App is fully functional!")
    print()


if __name__ == "__main__":
    asyncio.run(main())
