import re

with open("routers/dashboard.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add auth import
if "from auth import get_current_user" not in content:
    content = content.replace("from fastapi import APIRouter", "from fastapi import APIRouter, Depends\nfrom auth import get_current_user")

# 2. Add auth to dashboard routes
content = re.sub(
    r'async def get_dashboard\(\):',
    r'async def get_dashboard(user=Depends(get_current_user)):',
    content
)
# change default "user-123" to user["sub"]
content = content.replace('user_id = "user-123"', 'user_id = user["sub"]')

with open("routers/dashboard.py", "w", encoding="utf-8") as f:
    f.write(content)

with open("analysis/pipeline.py", "r", encoding="utf-8") as f:
    content = f.read()

# Re-apply granular state polling from Phase 1
# This might involve finding the analyze step. We already patched it using `patch.py` today.
# Wait, let me just add the `update_session_status` function and call it in `run_analysis_pipeline`.
status_patch = """
from services.db import get_db

async def update_session_status(session_id: str, status: str):
    try:
        db = get_db()
        db.table("sessions").update({"status": status}).eq("id", session_id).execute()
    except Exception as e:
        logger.error(f"Failed to update status to {status}: {e}")
"""
if "def update_session_status" not in content:
    content = content.replace("from services.db import get_db", status_patch)

# find def run_analysis_pipeline and inject it
if "await update_session_status(session_id, \"transcribing\")" not in content:
    content = content.replace(
        "async def run_analysis_pipeline(session_id: str, topic: str, user_id: str):",
        "async def run_analysis_pipeline(session_id: str, topic: str, user_id: str):\n    await update_session_status(session_id, \"transcribing\")"
    )
    content = content.replace(
        "analysis_payload = builder.build()",
        "await update_session_status(session_id, \"analyzing\")\n        analysis_payload = builder.build()"
    )
    content = content.replace(
        "coaching_results = await get_groq_coaching(analysis_payload)",
        "await update_session_status(session_id, \"generating_feedback\")\n        coaching_results = await get_groq_coaching(analysis_payload)"
    )

with open("analysis/pipeline.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Restored dashboard.py and pipeline.py")
