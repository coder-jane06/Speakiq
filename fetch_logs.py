import requests, json
try:
    res = requests.get("https://shaurya0606-speakiq-backend.hf.space/logs")
    if res.status_code == 200:
        data = res.json()
        if "logs" in data:
            for line in data["logs"]:
                print(line.strip())
        else:
            print(data)
    else:
        print(f"Error: {res.status_code}")
except Exception as e:
    print(f"Failed: {e}")
