"""
Create a proper test audio file for diagnostic testing.
This will generate a 30-second audio file with synthesized speech.
"""
import os
import sys
from pathlib import Path

print("Creating test audio file...")
print("=" * 60)

# Check if we have the spoken.wav file
spoken_wav = Path("../spoken.wav")
if spoken_wav.exists():
    print(f"✅ Found existing audio file: {spoken_wav}")
    print(f"   Size: {spoken_wav.stat().st_size} bytes")
    
    # Convert to WebM using ffmpeg
    output_path = Path("test_audio_real.webm")
    
    # Find ffmpeg
    ffmpeg_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        '..', 'ffmpeg_unzipped', 'ffmpeg-8.1.1-essentials_build', 'bin', 'ffmpeg.exe'
    )
    ffmpeg_path = os.path.normpath(ffmpeg_path)
    
    if not os.path.exists(ffmpeg_path):
        print(f"❌ ffmpeg not found at: {ffmpeg_path}")
        sys.exit(1)
    
    print(f"✅ Using ffmpeg: {ffmpeg_path}")
    print(f"\nConverting WAV to WebM...")
    
    import subprocess
    result = subprocess.run(
        [ffmpeg_path, '-y', '-i', str(spoken_wav), 
         '-c:a', 'libopus', '-b:a', '32k',
         str(output_path)],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"✅ Test audio created: {output_path}")
        print(f"   Size: {output_path.stat().st_size} bytes")
        print(f"\nYou can now run: python diagnose_issue.py")
        print(f"(Make sure to update diagnose_issue.py to use 'test_audio_real.webm')")
    else:
        print(f"❌ Conversion failed:")
        print(result.stderr)
        sys.exit(1)
else:
    print(f"❌ No audio file found at {spoken_wav}")
    print(f"\n📝 To create a test audio:")
    print(f"   1. Record a 30-second session through the web app")
    print(f"   2. Or copy an existing audio file to: {spoken_wav}")
    sys.exit(1)
