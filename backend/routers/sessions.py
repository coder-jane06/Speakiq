"""Sessions router — Phase 3 (with analysis pipeline)"""
import logging, random, uuid, asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header
import jwt

logger = logging.getLogger(__name__)
router = APIRouter()

FALLBACK_TOPICS = [
    {"id": "fallback", "text": "Should social media have an age limit?"},
    {"id": "fallback", "text": "Is remote work better than office work?"},
    {"id": "fallback", "text": "What makes a great leader?"},
    {"id": "fallback", "text": "Should college education be free?"},
    {"id": "fallback", "text": "How does technology affect human relationships?"},
    {"id": "fallback", "text": "Is ambition a virtue or a flaw?"},
    {"id": "fallback", "text": "What is the most important skill for the future?"},
    {"id": "fallback", "text": "Should voting be mandatory?"},
    {"id": "fallback", "text": "How do you define success?"},
    {"id": "fallback", "text": "Is social media doing more harm than good?"},
]
ALLOWED_AUDIO_TYPES = {
    "audio/webm","audio/webm;codecs=opus","audio/webm;codecs=vp8",
    "audio/mp4","audio/wav","audio/mpeg","audio/ogg","application/octet-stream"
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.get("/topic")
async def get_random_topic():
    try:
        from config import get_db
        result = get_db().table("topics").select("*").execute()
        if result.data:
            return random.choice(result.data)
    except Exception as e:
        logger.warning(f"[sessions] Supabase fallback: {e}")
    return random.choice(FALLBACK_TOPICS)


@router.post("/upload", status_code=201)
async def upload_session(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    topic_id: str = Form(...),
    topic_text: str = Form(...),
    authorization: Optional[str] = Header(None)
):
    content_type = audio.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Recording too short.")

    session_id = str(uuid.uuid4())
    audio_url = None

    # Extract user_id from JWT if provided
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        try:
            # Decode without verification (Supabase already verified it)
            decoded = jwt.decode(
                token, 
                options={"verify_signature": False}
            )
            user_id = decoded.get("sub")
        except Exception:
            user_id = None

    try:
        from config import get_db
        db = get_db()
        storage_path = f"sessions/{session_id}/recording.webm"
        db.storage.from_("audio-recordings").upload(
            path=storage_path, file=audio_bytes,
            file_options={"content-type": "audio/webm"},
        )
        audio_url = storage_path
        
        db.table("sessions").insert({
            "id": session_id,
            "topic_id": None,
            "topic_text": topic_text,
            "audio_url": audio_url,
            "status": "analyzing",
            "user_id": user_id,
        }).execute()
        logger.info(f"[sessions] Created session {session_id}")
    except Exception as e:
        logger.error(f"[sessions] Upload failed {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database or storage error: {e}")

    # Trigger analysis pipeline in the background
    # BackgroundTasks runs AFTER the response is sent to the user.
    # The user gets their session_id immediately (fast response),
    # while the heavy AI analysis runs in the background.
    background_tasks.add_task(
        trigger_analysis,
        session_id=session_id,
        audio_bytes=audio_bytes,
        topic_text=topic_text,
        user_id=user_id
    )

    return {"session_id": session_id, "status": "analyzing", "audio_url": audio_url}


async def trigger_analysis(session_id: str, audio_bytes: bytes, topic_text: str, user_id: Optional[str] = None):
    """Background task — runs after the HTTP response is sent."""
    try:
        from config import get_db
        # To accumulate sessions across multiple uploads, we fetch the first row 
        # (since a new session UUID is generated every time)
        if user_id:
            profile_result = get_db().table("user_profiles").select("*").eq("id", user_id).limit(1).execute()
        else:
            profile_result = get_db().table("user_profiles").select("*").limit(1).execute()
        user_profile = profile_result.data[0] if profile_result.data else None
    except:
        user_profile = None

    try:
        from analysis.pipeline import run_analysis_pipeline
        logger.info(f"[sessions] Starting pipeline for {session_id[:8]}")
        await run_analysis_pipeline(
            session_id=session_id,
            audio_bytes=audio_bytes,
            topic=topic_text,
            user_profile=user_profile,
            session_number=user_profile.get("total_sessions", 0) + 1 if user_profile else 1,
            user_id=user_id
        )
    except Exception as e:
        import traceback
        logger.error(f"[sessions] Pipeline failed for {session_id}: {e}")
        traceback.print_exc()
        try:
            from config import get_db
            get_db().table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as inner_e:
            logger.error(f"[sessions] Failed to update session status to failed: {inner_e}")


@router.get("/")
async def list_sessions():
    try:
        from config import get_db
        result = get_db().table("sessions").select("*").order("created_at", desc=True).limit(50).execute()
        return {"sessions": result.data}
    except Exception as e:
        logger.error(f"[sessions] list failed: {e}")
        return {"sessions": []}


@router.get("/{session_id}")
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    try:
        from config import get_db
        db = get_db()
        
        if session_id == "latest":
            # fetch the actual latest completed session for this user
            from routers.dashboard import get_user_id
            user_id = get_user_id(authorization) or "00000000-0000-0000-0000-000000000000"
            result = (
                db.table("sessions")
                .select("*, session_metrics(*)")
                .eq("user_id", user_id)
                .eq("status", "complete")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        else:
            result = (
                db.table("sessions")
                .select("*, session_metrics(*)")
                .eq("id", session_id)
                .execute()
            )
        
        logger.info(f"[sessions] get {session_id}: {len(result.data)} rows found")
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = result.data[0]
        
        # If session exists but has no metrics yet, return analyzing status
        # so frontend keeps polling or shows analyzing
        metrics = session.get("session_metrics", [])
        if not metrics or len(metrics) == 0:
            if session.get("status") != "failed":
                session["status"] = "analyzing"
            session["session_metrics"] = []
            return session
        
        return session
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[sessions] get failed {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))