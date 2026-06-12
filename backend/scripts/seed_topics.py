"""
SpeakIQ — Topic Seeder
Run AFTER applying migrate_v2.sql in Supabase.
Inserts 37 categorised topics using the Python client (no SQL column issues).
Safe to re-run — checks for duplicates first.
Usage: python scripts/seed_topics.py
"""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from config import get_db

db = get_db()

# All 37 topics — each explicitly sets tier (required NOT NULL column)
# Format: (text, tier, category, target_skill, goal_type)
TOPICS = [
    # ── ORATOR ──────────────────────────────────────────────────
    ("Tell the story of a moment that fundamentally changed how you see the world.", "easy",   "storytelling", "structure",  "orator"),
    ("Describe your hometown to someone who has never been there, making them feel like they are there.", "easy", "storytelling", "delivery", "orator"),
    ("Give a 60-second toast for someone who helped you through a difficult time.", "easy",   "speech",       "structure",  "orator"),
    ("Argue that failure is the world's most underrated teacher.",                  "medium", "persuasion",   "structure",  "orator"),
    ("Deliver the opening 90 seconds of a TED talk on any topic you are passionate about.", "medium", "speech", "delivery", "orator"),
    ("Speak on why silence is more powerful than words, with examples.",            "medium", "opinion",      "vocab",      "orator"),
    ("Use the rule of three to argue for the most important skill of the 21st century.", "hard", "persuasion", "structure", "orator"),
    ("Give a eulogy for an idea that society has abandoned too soon.",              "hard",   "storytelling", "delivery",   "orator"),
    ("Describe the emotion of hope without using the word hope or any synonym.",   "hard",   "creative",     "vocab",      "orator"),

    # ── DEBATER ─────────────────────────────────────────────────
    ("Should students be graded on effort rather than results? Argue one side.",   "easy",   "debate",       "structure",  "debater"),
    ("Is social media doing more harm than good to society? Pick a side.",         "easy",   "debate",       "structure",  "debater"),
    ("Should remote work be the default for all office jobs? Argue for or against.", "medium", "debate",     "confidence", "debater"),
    ("Are electric vehicles truly better for the environment? Make the case.",     "medium", "debate",       "structure",  "debater"),
    ("Should AI-generated art be eligible for awards? Defend your position.",      "medium", "debate",       "vocab",      "debater"),
    ("Universal basic income: economic safety net or productivity killer? Pick one.", "hard", "debate",      "structure",  "debater"),
    ("Is privacy a fundamental right or a luxury we can no longer afford? Argue.", "hard",   "debate",       "confidence", "debater"),
    ("Four-day work week: revolution or pipe dream? Build your strongest case.",   "hard",   "debate",       "structure",  "debater"),

    # ── PRESENTER ───────────────────────────────────────────────
    ("Explain what you do for a living to a 10-year-old in 60 seconds.",           "easy",   "explanation",  "vocab",      "presenter"),
    ("Pitch a simple app idea that solves an everyday problem.",                   "easy",   "pitch",        "structure",  "presenter"),
    ("Summarise the most interesting thing you learned this week in a 60-second brief.", "easy", "briefing", "delivery",  "presenter"),
    ("Explain the concept of compound interest to someone with no finance background.", "medium", "explanation", "vocab",  "presenter"),
    ("Present a recommendation: should your company switch to a 4-day work week?", "medium", "recommendation", "structure", "presenter"),
    ("Explain blockchain to a room of executives unfamiliar with the technology.", "hard",   "explanation",  "vocab",      "presenter"),
    ("Present a 90-second investment thesis for a startup you believe in.",        "hard",   "pitch",        "structure",  "presenter"),
    ("Walk through a failed project and the lessons learned, under 90 seconds.",   "hard",   "briefing",     "confidence", "presenter"),

    # ── INTERVIEWER ─────────────────────────────────────────────
    ("Tell me about yourself and why you are the right person for your dream job.", "easy",  "interview",    "confidence", "interviewer"),
    ("Describe a challenge you faced and how you overcame it, using the STAR method.", "easy", "interview",  "structure",  "interviewer"),
    ("What is your greatest professional weakness, and what are you doing about it?", "easy", "interview",   "confidence", "interviewer"),
    ("Tell me about a time you had to lead without formal authority.",              "medium", "interview",    "structure",  "interviewer"),
    ("Describe the biggest failure in your career and what you learned.",           "medium", "interview",    "confidence", "interviewer"),
    ("Where do you see yourself in five years? Make it specific and believable.",   "medium", "interview",    "structure",  "interviewer"),
    ("Walk me through a complex decision you made under pressure with incomplete information.", "hard", "interview", "structure", "interviewer"),
    ("Sell me on why I should choose you over a candidate with twice your experience.", "hard", "interview",  "confidence", "interviewer"),

    # ── GENERAL ─────────────────────────────────────────────────
    ("What is one habit that has had the biggest positive impact on your life?",   "easy",   "opinion",      "structure",  "general"),
    ("Describe your ideal day from start to finish.",                              "easy",   "storytelling", "delivery",   "general"),
    ("What does success mean to you, and how has that definition changed over time?", "medium", "opinion",   "vocab",      "general"),
    ("Convince someone to take a risk they have been avoiding for too long.",      "hard",   "persuasion",   "confidence", "general"),
]

def main():
    print("=" * 55)
    print("SpeakIQ Topic Seeder")
    print("=" * 55)

    # First verify the new columns exist
    try:
        test = db.table("topics").select("tier, target_skill, goal_type").limit(1).execute()
        print("[OK] topics schema has required columns")
    except Exception as e:
        print(f"\n[ERROR] topics is missing new columns: {e}")
        print("Please run migrate_v2.sql in Supabase SQL Editor first!")
        sys.exit(1)

    # Get existing topic texts to avoid duplicates
    existing_r = db.table("topics").select("text").execute()
    existing_texts = {row["text"] for row in (existing_r.data or [])}
    print(f"[INFO] Existing topics: {len(existing_texts)}")

    inserted = 0
    skipped  = 0

    for text, tier, category, target_skill, goal_type in TOPICS:
        if text in existing_texts:
            skipped += 1
            continue
        try:
            db.table("topics").insert({
                "text":         text,
                "tier":         tier,          # required NOT NULL
                "category":     category,
                "target_skill": target_skill,
                "goal_type":    goal_type,
            }).execute()
            inserted += 1
            print(f"  + [{goal_type:12s}] {text[:60]}")
        except Exception as e:
            print(f"  ! FAILED: {text[:50]} — {e}")

    print(f"\n{'=' * 55}")
    print(f"Done: {inserted} inserted, {skipped} skipped (already exist)")

    # Final count
    final_r = db.table("topics").select("*", count="exact").limit(0).execute()
    print(f"Total topics in DB: {final_r.count}")
    print("=" * 55)

if __name__ == "__main__":
    main()
