import asyncio
import os
import uuid
from supabase import create_client
from config import get_settings

async def create_mock_session():
    settings = get_settings()
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    
    users = db.table("user_profiles").select("id, user_id").limit(1).execute()
    user_id = ""
    if not users.data:
        user_id = str(uuid.uuid4())
        try:
            db.table("user_profiles").insert({"id": user_id, "user_id": user_id, "email": "mock@test.com", "name": "Mock User"}).execute()
        except Exception as e:
            print("Failed to create dummy user profile, using fake uuid anyway:", e)
    else:
        user_id = users.data[0].get("user_id") or users.data[0].get("id")
        
    session_id = str(uuid.uuid4())
    
    db.table("sessions").insert({
        "id": session_id,
        "user_id": user_id,
        "topic_text": "Mock Phase 2 Test",
        "status": "complete"
    }).execute()
    
    mock_metrics = {
        "session_id": session_id,
        "words": [
            {"word": "So", "start": 0.5, "end": 0.8},
            {"word": "basically", "start": 0.9, "end": 1.4},
            {"word": "I", "start": 2.5, "end": 2.6},
            {"word": "think", "start": 2.7, "end": 3.0},
            {"word": "this", "start": 3.1, "end": 3.3},
            {"word": "is", "start": 3.4, "end": 3.5},
            {"word": "a", "start": 3.6, "end": 3.7},
            {"word": "crucial", "start": 3.8, "end": 4.5},
            {"word": "point", "start": 4.6, "end": 5.0}
        ],
        "filler_words": [
            {"word": "basically", "count": 1, "timestamps": [0.9]}
        ],
        "hedge_words": [
            {"word": "think", "count": 1, "timestamps": [2.7]}
        ],
        "silence_gaps": [
            {"start": 1.4, "end": 2.5, "duration": 1.1}
        ],
        "wpm": 135.5,
        "pitch_variance": 42.1,
        "filler_detail": {"basically": 1},
        "silence_percentage": 10.5,
        "longest_pause_sec": 1.1,
        "duration_secs": 5.0,
        "filler_count": 1,
        
        "coaching_report": {
            "scores": {"overall": 85, "delivery": 88, "vocab": 90, "structure": 80, "filler": 70, "confidence": 85},
            "what_went_well": "You started with some fillers but recovered well.",
            "priority_fix": "Just say 'I think'",
            "daily_drill": "Pause practice: Pause before starting.",
            "worst_moment": {"quote": "So basically I think", "timestamp_s": 0.5, "what_went_wrong": "Stacked a filler and a hedge."},
            "rewritten_sentences": [{"original": "So basically I think this is a crucial point", "improved": "This is a crucial point."}]
        }
    }
    
    db.table("session_metrics").insert(mock_metrics).execute()
    
    # Also I need to patch my `patch_sessions.py` generated endpoints to read from `session_metrics`!
    print(f"Mock session created! Session ID: {session_id}")

if __name__ == "__main__":
    asyncio.run(create_mock_session())
