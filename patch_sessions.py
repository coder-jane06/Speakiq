import re

with open("routers/sessions.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add auth import
if "from auth import get_current_user" not in content:
    content = content.replace("from fastapi import APIRouter, UploadFile", "from fastapi import APIRouter, UploadFile, Depends\nfrom auth import get_current_user")

# 2. Add auth to /upload
content = re.sub(
    r'async def upload_session\(\n    background_tasks: BackgroundTasks,\n    audio: UploadFile = File\(\.\.\),\n    topic_id: str = Form\(\.\.\),\n    topic_text: str = Form\(\.\.\)\n\):',
    r'async def upload_session(\n    background_tasks: BackgroundTasks,\n    audio: UploadFile = File(...),\n    topic_id: str = Form(...),\n    topic_text: str = Form(...),\n    user=Depends(get_current_user)\n):',
    content
)
# change default "user-123" to user["sub"]
content = content.replace('user_id = "user-123"', 'user_id = user["sub"]')

# 3. Add auth to /{session_id}
content = re.sub(
    r'async def get_session\(session_id: str\):',
    r'async def get_session(session_id: str, user=Depends(get_current_user)):',
    content
)

# 4. Phase 1 Polling Fix (remove the hardcoded "analyzing" override)
content = re.sub(
    r'if session_data\["status"\] == "processing" and not session_data\.get\("metrics"\):\n        session_data\["status"\] = "analyzing"',
    r'',
    content
)

# 5. Add Phase 2 endpoints
phase2_endpoints = """

@router.get("/{session_id}/transcript")
async def get_transcript(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = db.table("sessions").select("metrics").eq("id", session_id).eq("user_id", user["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    metrics = result.data[0].get("metrics", {})
    words = metrics.get("words", [])
    fillers = metrics.get("filler_words", [])
    hedges = metrics.get("hedge_words", [])
    
    # Simple semantic typing
    filler_set = {f["word"] for f in fillers}
    hedge_set = {h["word"] for h in hedges}
    
    transcript_words = []
    for w in words:
        w_type = "normal"
        clean_word = w["word"].strip(".,!?").lower()
        if clean_word in filler_set:
            w_type = "filler"
        elif clean_word in hedge_set:
            w_type = "hedge"
        
        transcript_words.append({
            "word": w["word"],
            "start": w["start"],
            "end": w["end"],
            "type": w_type
        })
    return transcript_words

@router.get("/{session_id}/audio-url")
async def get_audio_url(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = db.table("sessions").select("id").eq("id", session_id).eq("user_id", user["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    url = db.storage.from_("audio").create_signed_url(
        path=f"{session_id}/audio.webm",
        expires_in=3600
    )
    return {"url": url.get("signedURL", "")}
"""

if "def get_transcript" not in content:
    content += phase2_endpoints

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Restored and Phase 2 patched sessions.py")
