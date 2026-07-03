"""Download the actual audio file from Supabase and test it locally."""
import sys
import os
from config import get_db

def download_and_test(session_id: str):
    """Download audio from Supabase and test it with Whisper."""
    
    print("=" * 70)
    print(f"DOWNLOADING AND TESTING AUDIO FOR SESSION: {session_id}")
    print("=" * 70)
    
    db = get_db()
    
    # Get session
    session = db.table("sessions").select("audio_url").eq("id", session_id).execute()
    if not session.data:
        print(f"❌ Session not found")
        return
    
    audio_path = session.data[0].get("audio_url")
    if not audio_path:
        print(f"❌ No audio URL found")
        return
    
    print(f"\n[1] Audio path in database: {audio_path}")
    
    # Download from Supabase storage
    print(f"\n[2] Downloading from Supabase storage...")
    try:
        audio_data = db.storage.from_("audio-recordings").download(audio_path)
        print(f"✅ Downloaded {len(audio_data)} bytes")
        
        # Save locally
        local_path = f"debug_audio_{session_id[:8]}.webm"
        with open(local_path, 'wb') as f:
            f.write(audio_data)
        print(f"✅ Saved to: {local_path}")
        
        # Check file size
        file_size = os.path.getsize(local_path)
        print(f"\n[3] File size: {file_size} bytes ({file_size / 1024:.2f} KB)")
        
        if file_size < 1000:
            print(f"   ⚠️  WARNING: File is very small (< 1KB) - likely empty or corrupted")
        elif file_size < 10000:
            print(f"   ⚠️  WARNING: File is small (< 10KB) - may be a very short recording")
        else:
            print(f"   ✅ File size looks reasonable")
        
        # Test with Whisper
        print(f"\n[4] Testing with Whisper transcription...")
        from analysis.whisper_service import whisper_service
        import asyncio
        
        async def test_whisper():
            result = await whisper_service.transcribe(local_path)
            return result
        
        result = asyncio.run(test_whisper())
        
        if result:
            print(f"✅ Whisper transcription successful!")
            print(f"   - Transcript: {result.transcript[:200]}...")
            print(f"   - Word count: {result.word_count}")
            print(f"   - Duration: {result.duration_secs:.1f}s")
            print(f"   - Words: {len(result.words)}")
            
            if result.word_count == 0:
                print(f"\n❌ PROBLEM: Whisper detected NO WORDS")
                print(f"   This means:")
                print(f"   1. The audio is silence/noise only")
                print(f"   2. Whisper's VAD filtered out all audio")
                print(f"   3. The recording quality is too poor")
            else:
                print(f"\n✅ Whisper detected words - pipeline should have worked!")
                print(f"   The issue must be in how the audio was uploaded/stored.")
        else:
            print(f"❌ Whisper transcription FAILED")
            print(f"   This indicates a problem with:")
            print(f"   1. Audio file format/corruption")
            print(f"   2. ffmpeg conversion failure")
            print(f"   3. Whisper model issue")
        
        # Test with acoustic analysis
        print(f"\n[5] Testing with Acoustic analysis...")
        from analysis.acoustic_service import acoustic_service
        
        acoustic_result = acoustic_service.analyze(local_path, word_count=result.word_count if result else 0)
        
        if acoustic_result:
            print(f"✅ Acoustic analysis successful!")
            print(f"   - WPM: {acoustic_result.wpm:.1f}")
            print(f"   - Duration: {acoustic_result.total_duration_secs:.1f}s")
            print(f"   - Pauses: {acoustic_result.pause_count}")
        else:
            print(f"❌ Acoustic analysis FAILED")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_and_test_audio.py <session_id>")
        sys.exit(1)
    
    download_and_test(sys.argv[1])
