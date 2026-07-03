import re
import json

with open("routers/sessions.py", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """
@router.get("/{session_id}/transcript")
async def get_transcript(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = db.table("session_metrics").select("*").eq("session_id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    metrics = result.data[0]
    
    import json
    
    words_raw = metrics.get("words", "[]")
    if isinstance(words_raw, str):
        try:
            words = json.loads(words_raw)
        except:
            words = []
    else:
        words = words_raw or []
        
    filler_positions_raw = metrics.get("filler_positions", "[]")
    if isinstance(filler_positions_raw, str):
        try:
            fillers = json.loads(filler_positions_raw)
        except:
            fillers = []
    else:
        fillers = filler_positions_raw or []
        
    filler_set = {f["word"] for f in fillers if "word" in f}
    
    transcript_words = []
    for w in words:
        w_type = "normal"
        if "word" not in w: continue
        clean_word = w["word"].strip(".,!?").lower()
        if clean_word in filler_set:
            w_type = "filler"
            
        transcript_words.append({
            "word": w["word"],
            "start": w.get("start", 0),
            "end": w.get("end", 0),
            "type": w_type
        })
    return transcript_words
"""

# Replace everything from @router.get("/{session_id}/transcript") to return transcript_words
content = re.sub(
    r'@router\.get\("/\{session_id\}/transcript"\).*?return transcript_words',
    replacement.strip(),
    content,
    flags=re.DOTALL
)

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed get_transcript JSON parsing in routers/sessions.py")
