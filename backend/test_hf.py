import requests, time, sys

url = "https://shaurya0606-speakiq-backend.hf.space/sessions/upload"

try:
    with open("test_audio.webm", "rb") as f:
        files = {"audio": ("test_audio.webm", f, "audio/webm")}
        data = {"topic_id": "fallback", "topic_text": "Test from script"}
        print(f"Uploading to {url}...")
        res = requests.post(url, files=files, data=data)
        print("Upload response:", res.status_code, res.text)
        if res.status_code == 201:
            session_id = res.json()["session_id"]
            for i in range(15):
                time.sleep(2)
                res2 = requests.get(f"https://shaurya0606-speakiq-backend.hf.space/sessions/{session_id}")
                if res2.status_code != 200:
                    print("Poll:", res2.status_code, res2.text)
                else:
                    data = res2.json()
                    print(f"Poll {i}: {data.get('status')}")
                    if data.get('status') in ['complete', 'failed', 'completed']:
                        sys.exit(0)
except Exception as e:
    print(f"Test failed: {e}")
