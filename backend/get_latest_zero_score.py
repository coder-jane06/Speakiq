"""Find the most recent session with 0 scores and debug it."""
import json
from config import get_db

db = get_db()

print("Finding most recent sessions with 0 scores...")
print("=" * 70)

# Get recent sessions
sessions = db.table("sessions").select("*").order("created_at", desc=True).limit(10).execute()

if not sessions.data:
    print("No sessions found")
    exit(1)

print(f"Found {len(sessions.data)} recent sessions\n")

for session in sessions.data:
    session_id = session['id']
    status = session.get('status')
    created = session.get('created_at', '')
    topic = session.get('topic_text', 'No topic')
    
    # Get metrics
    metrics = db.table("session_metrics").select("*").eq("session_id", session_id).execute()
    
    if metrics.data and len(metrics.data) > 0:
        m = metrics.data[0]
        coaching_raw = m.get("coaching_report")
        coaching = json.loads(coaching_raw) if isinstance(coaching_raw, str) else (coaching_raw or {})
        scores = coaching.get("scores", {})
        
        overall = sum([
            scores.get('filler', 0),
            scores.get('delivery', 0),
            scores.get('structure', 0),
            scores.get('vocab', 0),
            scores.get('confidence', 0)
        ]) / 5
        
        words_raw = m.get("words")
        words = json.loads(words_raw) if isinstance(words_raw, str) else (words_raw or [])
        word_count = len(words)
        
        print(f"Session: {session_id[:8]}...")
        print(f"  Created: {created[:19]}")
        print(f"  Status: {status}")
        print(f"  Topic: {topic[:60]}...")
        print(f"  Words detected: {word_count}")
        print(f"  Overall score: {overall:.0f}/100")
        print(f"  Scores: F={scores.get('filler',0)} D={scores.get('delivery',0)} S={scores.get('structure',0)} V={scores.get('vocab',0)} C={scores.get('confidence',0)}")
        
        if overall == 0:
            print(f"  ⚠️  ZERO SCORE SESSION FOUND!")
            print(f"\n  Full session ID: {session_id}")
            print(f"  Run: python debug_zero_score_session.py {session_id}")
            break
        
        print()
