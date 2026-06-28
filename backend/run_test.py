import requests, time, sys

url = "http://localhost:8001/sessions/upload"

try:
    with open("test_audio.webm", "rb") as f:
        files = {"audio": ("test_audio.webm", f, "audio/webm")}
        data = {"topic_id": "fallback", "topic_text": "Test"}
        print("Uploading...")
        res = requests.post(url, files=files, data=data)
        print(res.status_code, res.text)
        if res.status_code == 201:
            session_id = res.json()["session_id"]
            for i in range(15):
                time.sleep(2)
                res2 = requests.get(f"http://localhost:8001/sessions/{session_id}")
                if res2.status_code != 200:
                    print("Poll:", res2.status_code, res2.text)
                else:
                    data = res2.json()
                    print(f"Poll {i}: {data.get('status')}")
                    if data.get('status') in ['completed', 'failed']:
                        sys.exit(0)
except Exception as e:
    print(f"Test failed: {e}")
