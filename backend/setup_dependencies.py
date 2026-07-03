#!/usr/bin/env python3
"""
SpeakIQ Dependency Setup & Verification Script

This script:
1. Checks if all required Python packages are installed
2. Downloads the spaCy English model if missing
3. Verifies faster-whisper can load
4. Tests that ffmpeg is accessible
5. Validates Groq API key is set

Run this after: pip install -r requirements.txt
"""

import sys
import subprocess
import os
from pathlib import Path


def print_status(message, status="info"):
    """Print colored status messages"""
    colors = {
        "info": "\033[94m",      # Blue
        "success": "\033[92m",   # Green
        "warning": "\033[93m",   # Yellow
        "error": "\033[91m",     # Red
        "reset": "\033[0m"
    }
    
    symbols = {
        "info": "ℹ",
        "success": "✓",
        "warning": "⚠",
        "error": "✗"
    }
    
    color = colors.get(status, colors["info"])
    symbol = symbols.get(status, "•")
    print(f"{color}{symbol} {message}{colors['reset']}")


def check_package(package_name, import_name=None):
    """Check if a Python package is installed"""
    import_name = import_name or package_name
    try:
        __import__(import_name)
        print_status(f"{package_name} is installed", "success")
        return True
    except ImportError:
        print_status(f"{package_name} is NOT installed", "error")
        return False


def check_spacy_model():
    """Check if spaCy English model is downloaded"""
    try:
        import spacy
        try:
            nlp = spacy.load("en_core_web_sm")
            print_status("spaCy model 'en_core_web_sm' is installed", "success")
            return True
        except OSError:
            print_status("spaCy model 'en_core_web_sm' is NOT installed", "error")
            return False
    except ImportError:
        print_status("spaCy is not installed - cannot check model", "error")
        return False


def install_spacy_model():
    """Download and install spaCy English model"""
    print_status("Downloading spaCy English model...", "info")
    try:
        subprocess.run(
            [sys.executable, "-m", "spacy", "download", "en_core_web_sm"],
            check=True,
            capture_output=True
        )
        print_status("spaCy model installed successfully", "success")
        return True
    except subprocess.CalledProcessError as e:
        print_status(f"Failed to install spaCy model: {e}", "error")
        return False


def check_faster_whisper():
    """Check if faster-whisper can load"""
    try:
        from faster_whisper import WhisperModel
        print_status("faster-whisper is installed", "success")
        
        # Try to load the base model
        print_status("Testing faster-whisper model loading...", "info")
        model = WhisperModel("base", device="cpu", compute_type="int8")
        print_status("faster-whisper base model loaded successfully", "success")
        return True
    except ImportError:
        print_status("faster-whisper is NOT installed", "error")
        return False
    except Exception as e:
        print_status(f"faster-whisper failed to load: {e}", "error")
        return False


def check_ffmpeg():
    """Check if ffmpeg is accessible"""
    import shutil
    ffmpeg_path = shutil.which("ffmpeg")
    
    if ffmpeg_path:
        print_status(f"ffmpeg found at: {ffmpeg_path}", "success")
        return True
    else:
        # Check local installation
        local_ffmpeg = Path(__file__).parent.parent / "ffmpeg_unzipped" / "ffmpeg-7.0-essentials_build" / "bin" / "ffmpeg.exe"
        if local_ffmpeg.exists():
            print_status(f"ffmpeg found locally at: {local_ffmpeg}", "success")
            return True
        else:
            print_status("ffmpeg NOT found in system PATH or local directory", "warning")
            print_status("Audio analysis may fail. Install ffmpeg: https://ffmpeg.org/download.html", "info")
            return False


def check_groq_api():
    """Check if Groq API key is set"""
    from dotenv import load_dotenv
    load_dotenv()
    
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and len(groq_key) > 10:
        print_status("GROQ_API_KEY is set", "success")
        return True
    else:
        print_status("GROQ_API_KEY is NOT set in .env", "warning")
        print_status("AI coaching will use fallback responses. Get a key at: https://console.groq.com/", "info")
        return False


def check_supabase_config():
    """Check if Supabase credentials are set"""
    from dotenv import load_dotenv
    load_dotenv()
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if url and key:
        print_status("Supabase configuration is set", "success")
        return True
    else:
        print_status("Supabase configuration is INCOMPLETE", "error")
        print_status("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env", "info")
        return False


def main():
    print("\n" + "="*60)
    print("  SpeakIQ Dependency Verification")
    print("="*60 + "\n")
    
    all_ok = True
    
    # 1. Check core packages
    print_status("Checking core Python packages...", "info")
    packages = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("supabase", "supabase"),
        ("groq", "groq"),
        ("faster-whisper", "faster_whisper"),
        ("librosa", "librosa"),
        ("spacy", "spacy"),
        ("numpy", "numpy"),
        ("pydantic", "pydantic"),
    ]
    
    for pkg_name, import_name in packages:
        if not check_package(pkg_name, import_name):
            all_ok = False
    
    print()
    
    # 2. Check spaCy model
    print_status("Checking spaCy English model...", "info")
    if not check_spacy_model():
        all_ok = False
        response = input("\nDo you want to download the spaCy model now? (y/n): ")
        if response.lower() == 'y':
            if install_spacy_model():
                print_status("Please run this script again to verify", "info")
            else:
                print_status("Manual installation: python -m spacy download en_core_web_sm", "info")
    
    print()
    
    # 3. Check faster-whisper
    print_status("Checking faster-whisper...", "info")
    if not check_faster_whisper():
        all_ok = False
    
    print()
    
    # 4. Check ffmpeg
    print_status("Checking ffmpeg...", "info")
    if not check_ffmpeg():
        all_ok = False
    
    print()
    
    # 5. Check API keys
    print_status("Checking API configuration...", "info")
    if not check_groq_api():
        all_ok = False
    
    if not check_supabase_config():
        all_ok = False
    
    print("\n" + "="*60)
    if all_ok:
        print_status("All dependencies are properly configured!", "success")
        print_status("You can now run: uvicorn main:app --reload", "info")
    else:
        print_status("Some dependencies need attention", "warning")
        print_status("Fix the issues above, then run this script again", "info")
    print("="*60 + "\n")
    
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
