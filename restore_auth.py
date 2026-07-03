import re
import os

# Create .env
with open(".env", "w", encoding="utf-8") as f:
    f.write("SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdha2Zqc2hxend0Z3Fwa2Z0bnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0MjA1NywiZXhwIjoyMDk0NTE4MDU3fQ.nbzWPM1j_uNsrZFiWz61AkeFpXqxOxne_WEcM-4Ubbg\n")
    f.write("SUPABASE_URL=https://gakfjshqzwtgqpkftnyd.supabase.co\n")
    f.write("OPENAI_API_KEY=\n")
    f.write("GROQ_API_KEY=\n")

# Revert config.py
with open("config.py", "r", encoding="utf-8") as f:
    config_content = f.read()

config_content = re.sub(
    r"def get_db\(token: str = None\) -> Client:.*?return create_client\(s\.supabase_url, s\.supabase_service_key, options=options\)",
    'def get_db() -> Client:\n    """Returns a Supabase client using the service role key. Created per request to avoid stale httpx connection pools."""\n    s = get_settings()\n    if not s.supabase_url or not s.supabase_service_key:\n        logger.warning("Supabase URL or Key is empty. Database queries will fail.")\n    return create_client(s.supabase_url, s.supabase_service_key)',
    config_content,
    flags=re.DOTALL
)

with open("config.py", "w", encoding="utf-8") as f:
    f.write(config_content)


# Revert routers/sessions.py
with open("routers/sessions.py", "r", encoding="utf-8") as f:
    sessions_content = f.read()

sessions_content = sessions_content.replace('db = get_db(authorization)', 'db = get_db()')
sessions_content = sessions_content.replace('get_db(authorization)', 'get_db()')

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(sessions_content)

# Revert analysis/pipeline.py
with open("analysis/pipeline.py", "r", encoding="utf-8") as f:
    pipeline_content = f.read()

pipeline_content = pipeline_content.replace('db = get_db(authorization)', 'db = get_db()')
pipeline_content = pipeline_content.replace('get_db(authorization)', 'get_db()')

with open("analysis/pipeline.py", "w", encoding="utf-8") as f:
    f.write(pipeline_content)

# Revert routers/dashboard.py
with open("routers/dashboard.py", "r", encoding="utf-8") as f:
    dashboard_content = f.read()
dashboard_content = dashboard_content.replace('db = get_db(authorization)', 'db = get_db()')
with open("routers/dashboard.py", "w", encoding="utf-8") as f:
    f.write(dashboard_content)

print("Restored get_db calls and created .env file.")
