import requests, time

url = "https://shaurya0606-speakiq-backend.hf.space/logs"
print(f"Polling {url} until it comes up...")

for i in range(30):
    try:
        res = requests.get(url)
        if res.status_code == 200:
            print("Server is up!")
            break
        else:
            print(f"Status: {res.status_code} - {res.text[:50]}")
    except Exception as e:
        print(f"Error: {e}")
    time.sleep(10)
