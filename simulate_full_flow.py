import requests
import jwt
import time
import uuid

# 1. Generate a mock JWT for our local backend
SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
user_id = str(uuid.uuid4())
token = jwt.encode({"sub": user_id, "aud": "authenticated"}, SECRET, algorithm="HS256")

headers = {"Authorization": f"Bearer {token}"}

# 2. Upload a dummy audio file
print("Uploading audio...")
with open("test_audio.webm", "wb") as f:
    f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00") # tiny dummy wav
    f.write(b"\x00" * 2000) # pad to > 1000 bytes

files = {"audio": ("test_audio.webm", open("test_audio.webm", "rb"), "audio/webm")}
data = {"topic_id": "test", "topic_text": "Phase 2 Testing"}

res = requests.post("http://127.0.0.1:8002/sessions/upload", headers=headers, files=files, data=data)
if res.status_code != 201 and res.status_code != 200:
    print("Upload failed!", res.text)
    exit(1)

session_id = res.json()["session_id"]
print(f"Upload successful. Session ID: {session_id}")

# 3. Poll for completion
while True:
    time.sleep(2)
    poll_res = requests.get(f"http://127.0.0.1:8002/sessions/{session_id}", headers=headers)
    if poll_res.status_code == 200:
        status = poll_res.json().get("status")
        print(f"Status: {status}")
        if status in ["complete", "failed"]:
            break

print("Checking Phase 2 endpoints...")
transcript_res = requests.get(f"http://127.0.0.1:8002/sessions/{session_id}/transcript", headers=headers)
print("Transcript status:", transcript_res.status_code)
print("Transcript data:", transcript_res.text[:100])

audio_res = requests.get(f"http://127.0.0.1:8002/sessions/{session_id}/audio-url", headers=headers)
print("Audio URL status:", audio_res.status_code)
print("Audio URL data:", audio_res.text[:100])

print("Test complete!")
