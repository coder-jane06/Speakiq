import json
import os

transcript_path = r"C:\Users\GAMER\.gemini\antigravity\brain\1ec2a681-2f30-445b-ad0f-ce6fffa15f61\.system_generated\logs\transcript_full.jsonl"

target_files = [
    r"c:\Users\GAMER\Desktop\speakiq\auth.py",
    r"c:\Users\GAMER\Desktop\speakiq\main.py",
    r"c:\Users\GAMER\Desktop\speakiq\routers\dashboard.py",
    r"c:\Users\GAMER\Desktop\speakiq\routers\sessions.py",
    r"c:\Users\GAMER\Desktop\speakiq\analysis\pipeline.py"
]

file_contents = {}

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            tool_calls = data.get("tool_calls", [])
            for tc in tool_calls:
                args = tc.get("function", {}).get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)
                target = args.get("TargetFile", "").lower()
                if not target:
                    target = args.get("AbsolutePath", "").lower()

                for t_file in target_files:
                    if target == t_file.lower() or target.replace("\\", "/") == t_file.lower().replace("\\", "/"):
                        # If it's a write_to_file, we capture the full content
                        if tc["function"]["name"] == "default_api:write_to_file":
                            file_contents[t_file] = args.get("CodeContent", "")
        except Exception as e:
            pass

for filepath, content in file_contents.items():
    if content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Restored {filepath}")

