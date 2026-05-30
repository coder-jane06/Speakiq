import time
import requests
import subprocess
import os
import sys
import json

def main():
    print("Starting backend server...")
    with open("backend_logs2.txt", "w") as log_file:
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--port", "8003"],
            cwd=os.path.abspath("."),
            stdout=log_file,
            stderr=log_file
        )
        
        try:
            # Wait for backend to be ready
            for i in range(15):
                try:
                    res = requests.get("http://127.0.0.1:8003/")
                    if res.status_code in [200, 404]: 
                        print("Backend is up!")
                        break
                except requests.exceptions.ConnectionError:
                    time.sleep(1)
            else:
                print("Backend failed to start.")
                proc.kill()
                return
                
            print("\n--- Sending Session 1 (Real audio) ---")
            with open("test_audio.webm", "rb") as f:
                files = {"audio": ("test_audio.webm", f, "audio/webm")}
                data = {"topic_id": "fallback", "topic_text": "Universal Basic Income"}
                res = requests.post("http://127.0.0.1:8003/sessions/upload", files=files, data=data)
                session_data = res.json()
                print("Session 1 response:", session_data)
                session_id = session_data.get("session_id")
                
            print("Waiting 30 seconds for analysis pipeline to complete...")
            time.sleep(30)
            
            print("\n--- Fetching Results ---")
            res = requests.get(f"http://127.0.0.1:8003/sessions/{session_id}")
            results = res.json()
            metrics = results.get("session_metrics", [])
            coaching = {}
            if metrics:
                coaching = metrics[0].get("coaching_report", {})
            if isinstance(coaching, str):
                coaching = json.loads(coaching)
            
            print("\n\n=== FULL COACHING REPORT ===")
            for key, val in coaching.items():
                print(f"{key.upper()}:\n{val}\n")
            
        finally:
            print("\nCleaning up...")
            proc.kill()

if __name__ == "__main__":
    main()
