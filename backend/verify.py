import time
import requests
import subprocess
import os
import sys

def main():
    print("Starting backend server...")
    with open("backend_logs.txt", "w") as log_file:
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--port", "8002"],
            cwd=os.path.abspath("."),
            stdout=log_file,
            stderr=log_file
        )
        
        try:
            # Wait for backend to be ready
            for i in range(15):
                try:
                    res = requests.get("http://127.0.0.1:8002/")
                    if res.status_code in [200, 404]: 
                        print("Backend is up!")
                        break
                except requests.exceptions.ConnectionError:
                    time.sleep(1)
            else:
                print("Backend failed to start.")
                proc.kill()
                return
                
            with open("dummy_audio.webm", "wb") as f:
                f.write(b"0" * 1500)
                
            print("\n--- Sending Session 1 ---")
            with open("dummy_audio.webm", "rb") as f:
                files = {"audio": ("dummy.webm", f, "audio/webm")}
                data = {"topic_id": "fallback", "topic_text": "Is remote work better than office work?"}
                res = requests.post("http://127.0.0.1:8002/sessions/upload", files=files, data=data)
                print("Session 1 response:", res.json())
                
            print("Waiting 15 seconds for analysis pipeline to complete...")
            time.sleep(15)
            
            print("\n--- Sending Session 2 ---")
            with open("dummy_audio.webm", "rb") as f:
                files = {"audio": ("dummy2.webm", f, "audio/webm")}
                data = {"topic_id": "fallback", "topic_text": "Is remote work better than office work?"}
                res = requests.post("http://127.0.0.1:8002/sessions/upload", files=files, data=data)
                print("Session 2 response:", res.json())
                
            print("Waiting 15 seconds for analysis pipeline to complete...")
            time.sleep(15)
            
            print("\n--- Verifying Supabase user_profiles table ---")
            from config import get_db
            db = get_db()
            profiles = db.table("user_profiles").select("*").limit(1).execute()
            if profiles.data:
                print("\nUSER PROFILE ROW:")
                for k, v in profiles.data[0].items():
                    print(f"{k}: {v}")
            else:
                print("\nNO PROFILES FOUND!")
                
        finally:
            print("\nCleaning up...")
            proc.kill()
            if os.path.exists("dummy_audio.webm"):
                os.remove("dummy_audio.webm")

if __name__ == "__main__":
    main()
