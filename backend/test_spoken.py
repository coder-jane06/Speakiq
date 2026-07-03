import requests, time, sys

url = "https://shaurya0606-speakiq-backend.hf.space/sessions/upload"
print(f"Uploading spoken.wav to {url}...")
try:
    with open("../spoken.wav", "rb") as f:
        files = {"audio": ("spoken.wav", f, "audio/wav")}
        data = {"topic_id": "fallback", "topic_text": "Spoken Test"}
        res = requests.post(url, files=files, data=data)
        print("Upload response:", res.status_code, res.text)
        if res.status_code == 201:
            session_id = res.json()["session_id"]
            for i in range(25):
                time.sleep(2)
                res2 = requests.get(f"https://shaurya0606-speakiq-backend.hf.space/sessions/{session_id}")
                if res2.status_code == 200:
                    data = res2.json()
                    status = data.get('status')
                    print(f"Poll {i}: {status}")
                    if status in ['complete', 'failed', 'completed']:
                        sys.exit(0)
except Exception as e:
    print(f"Test failed: {e}")
