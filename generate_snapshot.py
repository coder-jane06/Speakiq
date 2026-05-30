import os
import re
import urllib.request
import urllib.error

root_dir = r"C:\Users\GAMER\Desktop\speakiq"
output_file = os.path.join(root_dir, "speakiq_snapshot.txt")

backend_dir = os.path.join(root_dir, "backend")
frontend_dir = os.path.join(root_dir, "frontend", "src")

backend_files = []
for root, _, files in os.walk(backend_dir):
    if "venv" in root or "__pycache__" in root:
        continue
    for f in files:
        if f.endswith(".py"):
            backend_files.append(os.path.join(root, f))

frontend_files = []
for root, _, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith((".tsx", ".ts", ".css")):
            frontend_files.append(os.path.join(root, f))

config_files = [
    os.path.join(root_dir, "frontend", "vite.config.ts"),
    os.path.join(root_dir, "frontend", "package.json"),
    os.path.join(root_dir, "frontend", ".env"),
    os.path.join(root_dir, "backend", "requirements.txt"),
    os.path.join(root_dir, "backend", ".env")
]

with open(output_file, "w", encoding="utf-8") as out:
    out.write("════════════════════════════════════════\n")
    out.write("STEP 1 — GET FULL FILE LIST\n")
    out.write("════════════════════════════════════════\n\n")
    
    out.write("BACKEND FILES:\n")
    for f in backend_files:
        out.write(f"{f}\n")
        
    out.write("\nFRONTEND FILES:\n")
    for f in frontend_files:
        out.write(f"{f}\n")

    out.write("\n════════════════════════════════════════\n")
    out.write("STEP 2 — READ EVERY BACKEND FILE\n")
    out.write("════════════════════════════════════════\n")
    for f in backend_files:
        rel_path = os.path.relpath(f, root_dir).replace("\\", "/")
        out.write(f"\n========================================\nFILE: {rel_path}\n========================================\n")
        try:
            with open(f, "r", encoding="utf-8") as infile:
                out.write(infile.read() + "\n")
        except Exception as e:
            out.write(f"Error reading file: {e}\n")

    out.write("\n════════════════════════════════════════\n")
    out.write("STEP 3 — READ EVERY FRONTEND FILE\n")
    out.write("════════════════════════════════════════\n")
    for f in frontend_files:
        rel_path = os.path.relpath(f, root_dir).replace("\\", "/")
        out.write(f"\n========================================\nFILE: {rel_path}\n========================================\n")
        try:
            with open(f, "r", encoding="utf-8") as infile:
                out.write(infile.read() + "\n")
        except Exception as e:
            out.write(f"Error reading file: {e}\n")

    out.write("\n════════════════════════════════════════\n")
    out.write("STEP 4 — READ CONFIG FILES\n")
    out.write("════════════════════════════════════════\n")
    for f in config_files:
        rel_path = os.path.relpath(f, root_dir).replace("\\", "/")
        out.write(f"\n========================================\nFILE: {rel_path}\n========================================\n")
        try:
            if not os.path.exists(f):
                out.write("FILE NOT FOUND\n")
                continue
            with open(f, "r", encoding="utf-8") as infile:
                content = infile.read()
                if ".env" in f:
                    content = re.sub(r"(?<=^SUPABASE_SERVICE_KEY=).*", "***", content, flags=re.MULTILINE)
                    content = re.sub(r"(?<=^OPENAI_API_KEY=).*", "***", content, flags=re.MULTILINE)
                    content = re.sub(r"(?<=^ANTHROPIC_API_KEY=).*", "***", content, flags=re.MULTILINE)
                    content = re.sub(r"(?<=^GROQ_API_KEY=).*", "***", content, flags=re.MULTILINE)
                    content = re.sub(r"(?<=^VITE_SUPABASE_ANON_KEY=).*", "***", content, flags=re.MULTILINE)
                out.write(content + "\n")
        except Exception as e:
            out.write(f"Error reading file: {e}\n")

    out.write("\n════════════════════════════════════════\n")
    out.write("STEP 5 — SUPABASE TABLE SCHEMAS\n")
    out.write("════════════════════════════════════════\n")
    out.write("NOTE: Direct SQL execution requires a Postgres connection string which is not present in the .env file (only REST/GraphQL URL is provided). Please run the requested SQL commands manually in the Supabase SQL Editor.\n")

    out.write("\n════════════════════════════════════════\n")
    out.write("STEP 6 — CURRENT APP STATUS TEST\n")
    out.write("════════════════════════════════════════\n")
    
    # Simple check if servers are running
    def check_server(url):
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=2) as response:
                return f"✅ Working (HTTP {response.getcode()})"
        except urllib.error.URLError as e:
            if hasattr(e, 'code'):
                return f"✅ Working (HTTP {e.code})"
            return f"❌ Broken (Connection Error: {e.reason})"
        except Exception as e:
            return f"❌ Broken (Error: {e})"
            
    frontend_status = check_server("http://localhost:5173")
    backend_status = check_server("http://localhost:8000/docs")
    
    out.write(f"TEST 1: Open localhost:5173\nResult: Frontend Server: {frontend_status}\n\n")
    out.write(f"TEST 1.1: Backend Server (localhost:8000)\nResult: Backend Server: {backend_status}\n\n")
    
    out.write("NOTE: Full E2E flows (Login, Dashboard, Recording, Results) require a browser testing framework like Playwright. Please perform manual testing for Tests 2-6 or run an automated E2E script.\n")

print(f"Snapshot written successfully to {output_file}")
