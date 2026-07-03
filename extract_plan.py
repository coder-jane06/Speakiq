import json

transcript_path = r"C:\Users\GAMER\.gemini\antigravity\brain\1ec2a681-2f30-445b-ad0f-ce6fffa15f61\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        if data.get("type") == "USER_INPUT":
            with open("master_plan.md", "w", encoding="utf-8") as out_f:
                out_f.write(data.get("content", ""))
            print("Extracted master plan.")
            break
