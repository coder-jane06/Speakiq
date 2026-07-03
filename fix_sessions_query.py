import re

with open("routers/sessions.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'result = db.table("sessions").select("metrics").eq("id", session_id).eq("user_id", user["sub"]).execute()',
    'result = db.table("session_metrics").select("*").eq("session_id", session_id).execute()'
)
content = content.replace(
    'metrics = result.data[0].get("metrics", {})',
    'metrics = result.data[0]'
)

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(content)
