"""Sessions router — Phase 3 (with analysis pipeline)"""
import logging, random, uuid, asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header
import jwt
from routers.dashboard import normalize_difficulty, normalize_goal

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


def get_user_id(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.replace("Bearer ", "")
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")
    except Exception:
        return None


@router.get("/topic")
async def get_topic(
    authorization: Optional[str] = Header(None),
    exclude: Optional[str] = None,
    goal: Optional[str] = None,
    difficulty: Optional[str] = None
):
    from config import get_db

    db = get_db()
    user_id = get_user_id(authorization)
    speaking_goal = normalize_goal(goal) if goal else "general"
    weakest_skill = "general"
    diff_tier = difficulty if difficulty else "medium"
    recent_topic_texts = []

    if user_id:
        try:
            profile = (
                db.table("user_profiles")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if profile.data:
                p = profile.data[0]
                if not goal:
                    speaking_goal = normalize_goal(p.get("speaking_goal")) or "general"
                
                if not difficulty:
                    tier = normalize_difficulty(p.get("difficulty_tier")) or "beginner"
                    diff_tier = {"beginner": "easy", "advanced": "hard"}.get(tier, "medium")

                skill_scores = {
                    "structure": p.get("structure_score") or 50,
                    "vocab": p.get("vocab_score") or 50,
                    "delivery": p.get("delivery_score") or 50,
                    "confidence": p.get("confidence_score") or 50,
                }
                weakest_skill = min(skill_scores, key=skill_scores.get)

            recent = (
                db.table("sessions")
                .select("topic_text")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            recent_topic_texts = [
                r["topic_text"]
                for r in (recent.data or [])
                if r.get("topic_text")
            ]
        except Exception as e:
            logger.warning(f"[sessions] Topic personalization skipped: {e}")

    try:
        # DB column is 'tier' (not 'difficulty') — select it correctly
        query = db.table("topics").select("id, text, tier, target_skill, category, goal_type")
        if speaking_goal != "general":
            query = query.in_("goal_type", [speaking_goal, "general"])
        result = query.limit(50).execute()

        if result.data:
            candidates = [t for t in result.data if t.get("text")]
            
            if exclude:
                filtered_candidates = [t for t in candidates if str(t.get("id")) != exclude]
                if filtered_candidates:
                    candidates = filtered_candidates
            
            # Prefer unseen topics; fall back to full list if all seen
            unseen = [t for t in candidates if t["text"] not in recent_topic_texts]
            if unseen:
                candidates = unseen

            # Prefer topics targeting the user's weakest skill
            skill_matched = [t for t in candidates if t.get("target_skill") == weakest_skill]
            if skill_matched:
                candidates = skill_matched

            # Prefer topics matching the user's difficulty tier
            tier_matched = [t for t in candidates if t.get("tier") == diff_tier]
            if tier_matched:
                candidates = tier_matched

            chosen = random.choice(candidates)
            topic_tier = chosen.get("tier", "medium")
            return {
                "id": chosen.get("id", "topic"),
                "text": chosen["text"],
                "tier": topic_tier,
                "difficulty": topic_tier,          # alias for frontend
                "target_skill": chosen.get("target_skill", "general"),
                "category": chosen.get("category", "opinion"),
                "goal_type": chosen.get("goal_type", "general"),
            }
    except Exception as e:
        logger.warning(f"[sessions] Supabase topic query failed: {e}")

    chosen = random.choice(FALLBACK_TOPICS)
    return {
        **chosen,
        "tier": "medium",
        "difficulty": "medium",
        "target_skill": "general",
        "category": "opinion",
        "goal_type": "general",
    }


@router.post("/upload", status_code=201)
async def upload_session(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    topic_id: str = Form(...),
    topic_text: str = Form(...),
    speaking_goal: Optional[str] = Form(None),
    difficulty_tier: Optional[str] = Form(None),
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

    user_id = get_user_id(authorization)
    normalized_goal = normalize_goal(speaking_goal)
    normalized_difficulty = normalize_difficulty(difficulty_tier)

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

        if user_id and (speaking_goal or difficulty_tier):
            try:
                pref_payload = {
                    "speaking_goal": normalized_goal,
                    "difficulty_tier": normalized_difficulty,
                    "onboarding_complete": True,
                }
                existing_profile = (
                    db.table("user_profiles")
                    .select("id")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if existing_profile.data:
                    db.table("user_profiles").update(pref_payload).eq("user_id", user_id).execute()
                else:
                    db.table("user_profiles").insert({"user_id": user_id, **pref_payload}).execute()
            except Exception as profile_e:
                logger.warning(f"[sessions] Preference update skipped: {profile_e}")
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
        user_id=user_id,
        speaking_goal=normalized_goal,
        difficulty_tier=normalized_difficulty,
    )

    return {"session_id": session_id, "status": "analyzing", "audio_url": audio_url}


async def trigger_analysis(
    session_id: str,
    audio_bytes: bytes,
    topic_text: str,
    user_id: Optional[str] = None,
    speaking_goal: str = "general",
    difficulty_tier: str = "beginner",
):
    """Background task — runs after the HTTP response is sent."""
    try:
        from config import get_db
        if user_id:
            profile_result = get_db().table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute()
            user_profile = profile_result.data[0] if profile_result.data else None
        else:
            user_profile = None
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
            session_number=(user_profile.get("total_sessions") or 0) + 1 if user_profile else 1,
            user_id=user_id,
            speaking_goal_override=speaking_goal,
            difficulty_tier=difficulty_tier,
        )
    except Exception as e:
        import traceback
        logger.error(f"[sessions] Pipeline failed for {session_id}:\n{traceback.format_exc()}")
        try:
            from config import get_db
            get_db().table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as inner_e:
            logger.error(f"[sessions] Failed to update session status to failed: {inner_e}")


@router.get("/")
async def list_sessions(authorization: Optional[str] = Header(None)):
    """Return only the authenticated user's sessions."""
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        from config import get_db
        result = (
            get_db()
            .table("sessions")
            .select("id, topic_text, created_at, status")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
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
