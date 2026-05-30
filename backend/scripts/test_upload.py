import io
import os
import sys
import time
import json
import requests
import wave
import struct

from pathlib import Path

# Ensure backend package imports work when running this script from repo root
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config import get_settings

S = get_settings()
SUPABASE_URL = S.supabase_url
SERVICE_KEY = S.supabase_service_key

def create_test_user(email, password):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json"
    }
    payload = {"email": email, "password": password, "email_confirm": True}
    r = requests.post(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()

def sign_in(email, password):
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {"apikey": SERVICE_KEY, "Content-Type": "application/x-www-form-urlencoded"}
    data = {"email": email, "password": password}
    r = requests.post(url, headers=headers, data=data)
    r.raise_for_status()
    return r.json()

def make_sine_wav(duration_s=1.0, freq=440.0, rate=16000):
    n_samples = int(rate * duration_s)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        for i in range(n_samples):
            value = int(32767.0 * 0.1 * __import__('math').sin(2.0 * __import__('math').pi * freq * (i / rate)))
            data = struct.pack('<h', value)
            wf.writeframesraw(data)
    return buf.getvalue()

def upload_test_audio(token, audio_bytes):
    url = "http://localhost:8002/sessions/upload"
    headers = {"Authorization": f"Bearer {token}"}
    files = {"audio": ("test.wav", audio_bytes, "audio/wav")}
    data = {"topic_id": "fallback", "topic_text": "Automated test upload"}
    r = requests.post(url, headers=headers, files=files, data=data, timeout=30)
    try:
        print("STATUS", r.status_code)
        print(r.text)
    except Exception:
        print("Upload failed without JSON response")
    r.raise_for_status()
    return r.json()

def main():
    test_email = f"test_user_{int(time.time())}@example.com"
    test_pw = "TestPass123!"
    print("Creating test user:", test_email)
    try:
        create_test_user(test_email, test_pw)
    except requests.exceptions.HTTPError as e:
        print("Create user failed (may already exist or admin disabled):", e)
    print("Signing in...")
    access_token = None
    try:
        token_resp = sign_in(test_email, test_pw)
        access_token = token_resp.get("access_token")
    except Exception as e:
        print("Sign-in failed, will try anonymous upload:", e)

    print("Generating WAV...")
    audio = make_sine_wav()
    print("Uploading to API...")
    try:
        if access_token:
            resp = upload_test_audio(access_token, audio)
        else:
            # anonymous upload (no Authorization header)
            url = "http://localhost:8002/sessions/upload"
            files = {"audio": ("test.wav", audio, "audio/wav")}
            data = {"topic_id": "fallback", "topic_text": "Automated anonymous upload"}
            r = requests.post(url, files=files, data=data, timeout=30)
            print("STATUS", r.status_code)
            print(r.text)
            r.raise_for_status()
            resp = r.json()
        print("Upload response:", json.dumps(resp, indent=2))
    except Exception as e:
        print("Upload failed:", e)

if __name__ == '__main__':
    main()
