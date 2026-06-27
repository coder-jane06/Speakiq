import requests, time
url = "https://shaurya0606-speakiq-backend.hf.space"
with open("test.webm", "wb") as f:
    f.write(b"fake audio data" * 100)
files = {"audio": ("test.webm", open("test.webm", "rb"), "audio/webm")}
data = {"topic_id": "fallback", "topic_text": "Test"}
print("Uploading...")
res = requests.post(f"{url}/sessions/upload", files=files, data=data)
print(res.status_code, res.text)
if res.status_code == 201:
    session_id = res.json()["session_id"]
    for _ in range(10):
        time.sleep(2)
        res = requests.get(f"{url}/sessions/{session_id}")
        if res.status_code != 200:
            print("Poll:", res.status_code, res.text)
        else:
            print("Poll:", res.status_code, res.json())
