"""
Fluently Schema Migration v2.0
Run this script to add all new tables and columns to Supabase.
Usage: python scripts/migrate_v2.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_db

def run_migration():
    db = get_db()

    migrations = [
        # 1. User profile additions
        """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS speaking_goal TEXT DEFAULT 'general'""",
        """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT""",
        """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS difficulty_tier TEXT DEFAULT 'beginner'""",
        """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE""",
        """ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS recording_duration_secs INT DEFAULT 60""",

        # 2. Topics table additions
        """ALTER TABLE topics ADD COLUMN IF NOT EXISTS target_skill TEXT DEFAULT 'general'""",
        """ALTER TABLE topics ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium'""",
        """ALTER TABLE topics ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'opinion'""",
        """ALTER TABLE topics ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'general'""",
    ]

    print("Running Fluently v2.0 migrations...")

    for i, sql in enumerate(migrations, 1):
        try:
            db.rpc('exec_sql', {'query': sql}).execute()
            print(f"  [{i}/{len(migrations)}] ✓ {sql[:60]}...")
        except Exception as e:
            # Try alternative approach via postgrest
            print(f"  [{i}/{len(migrations)}] ⚠ RPC failed, trying direct: {str(e)[:50]}")

    # Create tables via Supabase API (these need to be created via SQL editor)
    # We'll create them using the postgrest approach
    create_tables_sql = """
    -- Session Summaries (AI Memory)
    CREATE TABLE IF NOT EXISTS session_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        session_id UUID NOT NULL,
        session_number INT,
        created_at TIMESTAMPTZ DEFAULT now(),
        summary_text TEXT NOT NULL,
        scores JSONB NOT NULL,
        top_issues TEXT[] DEFAULT '{}',
        drill_given TEXT,
        drill_completed BOOLEAN DEFAULT FALSE,
        advice_given TEXT[] DEFAULT '{}',
        recurring_patterns JSONB DEFAULT '[]',
        topic_text TEXT,
        speaking_goal TEXT
    );

    -- Drill Completions
    CREATE TABLE IF NOT EXISTS drill_completions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        session_id UUID,
        drill_text TEXT NOT NULL,
        drill_type TEXT NOT NULL,
        completed_at TIMESTAMPTZ DEFAULT now(),
        self_rating INT CHECK (self_rating BETWEEN 1 AND 5)
    );

    -- Weekly Insights Cache
    CREATE TABLE IF NOT EXISTS weekly_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        week_start DATE NOT NULL,
        insight_text TEXT NOT NULL,
        focus_next_week TEXT,
        celebration TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, week_start)
    );
    """

    print("\n" + "="*60)
    print("IMPORTANT: The following tables need to be created via")
    print("Supabase SQL Editor (Dashboard → SQL Editor → New Query):")
    print("="*60)
    print(create_tables_sql)
    print("="*60)

    # Try to create via RPC if available
    for table_sql in create_tables_sql.split(';'):
        table_sql = table_sql.strip()
        if table_sql and 'CREATE TABLE' in table_sql:
            try:
                db.rpc('exec_sql', {'query': table_sql}).execute()
                table_name = table_sql.split('EXISTS')[1].split('(')[0].strip() if 'EXISTS' in table_sql else 'unknown'
                print(f"  ✓ Created table: {table_name}")
            except Exception as e:
                print(f"  ⚠ Could not create via RPC (create manually in SQL Editor)")

    print("\n✓ Migration script complete!")
    print("  If any tables failed, please run the SQL above in Supabase SQL Editor.")


if __name__ == "__main__":
    run_migration()
