"""
Debug script to investigate why a session got 0 scores.
Run this with the session ID from the URL to see what data was stored.
"""
import sys
import json
from config import get_db

def debug_session(session_id: str):
    """Debug a specific session to see why it got 0 scores."""
    
    print("=" * 70)
    print(f"DEBUGGING SESSION: {session_id}")
    print("=" * 70)
    
    db = get_db()
    
    # Fetch session
    print("\n[1] Fetching session data...")
    try:
        session_result = db.table("sessions").select("*").eq("id", session_id).execute()
        if not session_result.data:
            print(f"❌ Session {session_id} not found!")
            return
        
        session = session_result.data[0]
        print(f"✅ Session found")
        print(f"   Status: {session.get('status')}")
        print(f"   Topic: {session.get('topic_text')}")
        print(f"   Audio URL: {session.get('audio_url')}")
        print(f"   Created: {session.get('created_at')}")
    except Exception as e:
        print(f"❌ Error fetching session: {e}")
        return
    
    # Fetch metrics
    print("\n[2] Fetching session_metrics...")
    try:
        metrics_result = db.table("session_metrics").select("*").eq("session_id", session_id).execute()
        if not metrics_result.data:
            print(f"❌ No metrics found for session {session_id}!")
            print("   This means the analysis pipeline never completed or failed.")
            return
        
        metrics = metrics_result.data[0]
        print(f"✅ Metrics found")
        
        # Parse JSON fields
        transcript = metrics.get("transcript", "")
        words_raw = metrics.get("words")
        words = json.loads(words_raw) if isinstance(words_raw, str) else (words_raw or [])
        
        filler_count = metrics.get("filler_count", 0)
        filler_detail_raw = metrics.get("filler_detail")
        filler_detail = json.loads(filler_detail_raw) if isinstance(filler_detail_raw, str) else (filler_detail_raw or {})
        
        coaching_raw = metrics.get("coaching_report")
        coaching = json.loads(coaching_raw) if isinstance(coaching_raw, str) else (coaching_raw or {})
        
        # Display analysis
        print(f"\n   📝 TRANSCRIPT:")
        print(f"      Length: {len(transcript)} chars")
        print(f"      Content: {transcript[:200]}{'...' if len(transcript) > 200 else ''}")
        
        print(f"\n   🔊 WORDS DETECTED:")
        print(f"      Count: {len(words)}")
        if len(words) > 0:
            print(f"      First 5 words: {[w.get('word', '') for w in words[:5]]}")
        else:
            print(f"      ⚠️  NO WORDS DETECTED - This is why you got 0 scores!")
        
        print(f"\n   📊 ACOUSTIC DATA:")
        print(f"      WPM: {metrics.get('wpm', 0)}")
        print(f"      Pauses: {metrics.get('pause_count', 0)}")
        print(f"      Pitch mean: {metrics.get('pitch_mean', 0)}")
        print(f"      Pitch std: {metrics.get('pitch_std', 0)}")
        
        print(f"\n   🎯 FILLER ANALYSIS:")
        print(f"      Count: {filler_count}")
        print(f"      Breakdown: {filler_detail}")
        
        print(f"\n   🤖 COACHING SCORES:")
        scores = coaching.get("scores", {})
        print(f"      Filler: {scores.get('filler', 0)}/100")
        print(f"      Delivery: {scores.get('delivery', 0)}/100")
        print(f"      Structure: {scores.get('structure', 0)}/100")
        print(f"      Vocab: {scores.get('vocab', 0)}/100")
        print(f"      Confidence: {scores.get('confidence', 0)}/100")
        
        print(f"\n   💬 COACHING FEEDBACK:")
        print(f"      What went well: {coaching.get('what_went_well', 'N/A')[:100]}...")
        print(f"      Priority fix: {coaching.get('priority_fix', 'N/A')[:100]}...")
        
        # Analyze the root cause
        print("\n" + "=" * 70)
        print("ROOT CAUSE ANALYSIS:")
        print("=" * 70)
        
        if len(words) == 0:
            print("❌ ZERO WORDS DETECTED")
            print("\nPossible reasons:")
            print("  1. Audio file was empty or corrupted")
            print("  2. Whisper's VAD filtered out all audio as silence")
            print("  3. Audio was too quiet to detect speech")
            print("  4. ffmpeg failed to convert the audio properly")
            print("  5. Recording was stopped immediately (< 1 second)")
            
            if metrics.get('wpm', 0) == 0:
                print("\n⚠️  WPM is also 0 - Acoustic analysis likely failed too")
            else:
                print(f"\n✅ WPM is {metrics.get('wpm', 0)} - Audio file had sound, but no speech detected")
        else:
            print(f"✅ {len(words)} words were detected")
            print("   The zero score must be due to something else...")
        
    except Exception as e:
        print(f"❌ Error fetching metrics: {e}")
        import traceback
        traceback.print_exc()
        return

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_zero_score_session.py <session_id>")
        print("\nExample:")
        print("  python debug_zero_score_session.py 4c6b560c-0e7e-4e71-852c-3c7a66d7b7f1")
        sys.exit(1)
    
    session_id = sys.argv[1]
    debug_session(session_id)
