import requests
import io

url = "http://localhost:8000/sessions/upload"

# Create a small dummy audio file (must be > 1000 bytes)
audio_data = b"0" * 1500
files = {"audio": ("test.webm", audio_data, "audio/webm")}
data = {
    "topic_id": "topic_123",
    "topic_text": "Test topic",
    "speaking_goal": "general",
    "difficulty_tier": "beginner"
}

print("Uploading...")
res = requests.post(url, files=files, data=data)
print(res.status_code, res.text)
