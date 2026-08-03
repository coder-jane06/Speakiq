"""Sessions router — Phase 3 (with analysis pipeline)"""
import logging, random, uuid, asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from routers.dashboard import normalize_difficulty, normalize_goal
from auth import get_user_id

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

FALLBACK_TOPICS = [
    # ── GENERAL / OPINION (easy) ─────────────────────────────────────────
    {"id": "fallback", "text": "Should social media have an age limit?", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is remote work better than office work?", "tier": "easy", "target_skill": "confidence", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "What makes a great leader?", "tier": "easy", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "How do you define success?", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is technology making us more or less creative?", "tier": "easy", "target_skill": "delivery", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should students be graded on effort, not just results?", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is kindness more important than intelligence?", "tier": "easy", "target_skill": "confidence", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "What one habit would you recommend to everyone?", "tier": "easy", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Does social media help or hurt real friendships?", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should people follow their passion or follow the money?", "tier": "easy", "target_skill": "confidence", "category": "opinion", "goal_type": "general"},

    # ── GENERAL / OPINION (medium) ───────────────────────────────────────
    {"id": "fallback", "text": "Should voting be mandatory in a democracy?", "tier": "medium", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is ambition a virtue or a flaw?", "tier": "medium", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should college education be free?", "tier": "medium", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "How does technology affect human relationships?", "tier": "medium", "target_skill": "delivery", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is social media doing more harm than good?", "tier": "medium", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "What is the most important skill for the future?", "tier": "medium", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is it more important to be liked or respected?", "tier": "medium", "target_skill": "confidence", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should AI-generated art be treated as real art?", "tier": "medium", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Does failure teach more than success?", "tier": "medium", "target_skill": "delivery", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is it ethical to eat meat in the modern world?", "tier": "medium", "target_skill": "structure", "category": "opinion", "goal_type": "general"},

    # ── GENERAL / OPINION (hard) ─────────────────────────────────────────
    {"id": "fallback", "text": "Can democracy survive in the age of misinformation?", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should governments be allowed to limit free speech online?", "tier": "hard", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Is economic growth compatible with fighting climate change?", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Does individual privacy matter more than national security?", "tier": "hard", "target_skill": "confidence", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Should wealthy nations have open borders?", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "general"},

    # ── STORYTELLING (easy-medium) ───────────────────────────────────────
    {"id": "fallback", "text": "Tell me about a moment when you surprised yourself.", "tier": "easy", "target_skill": "delivery", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "Describe a time you had to make a difficult choice with no right answer.", "tier": "medium", "target_skill": "structure", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "Talk about a small moment that changed how you see the world.", "tier": "easy", "target_skill": "vocab", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "Describe the most important lesson a failure taught you.", "tier": "medium", "target_skill": "confidence", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "Tell me about someone who changed the way you think.", "tier": "easy", "target_skill": "delivery", "category": "storytelling", "goal_type": "general"},

    # ── INTERVIEW PRACTICE ───────────────────────────────────────────────
    {"id": "fallback", "text": "Tell me about a time you led without formal authority.", "tier": "medium", "target_skill": "structure", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Describe a situation where you had to convince a skeptical colleague.", "tier": "medium", "target_skill": "confidence", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Tell me about a project that went wrong and how you handled it.", "tier": "medium", "target_skill": "structure", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Give an example of a time you had to learn something new very quickly.", "tier": "easy", "target_skill": "delivery", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Describe a time you had to balance multiple competing priorities.", "tier": "hard", "target_skill": "structure", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Tell me about a time you disagreed with your manager and how you handled it.", "tier": "hard", "target_skill": "confidence", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Walk me through a time you improved a process or system at work.", "tier": "medium", "target_skill": "structure", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Describe your greatest professional achievement and why it matters.", "tier": "medium", "target_skill": "confidence", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Tell me about a time you made a mistake and what you learned from it.", "tier": "easy", "target_skill": "structure", "category": "scenario", "goal_type": "interviewer"},
    {"id": "fallback", "text": "Describe a moment when you had to adapt quickly to an unexpected change.", "tier": "medium", "target_skill": "delivery", "category": "scenario", "goal_type": "interviewer"},

    # ── DEBATE PRACTICE ──────────────────────────────────────────────────
    {"id": "fallback", "text": "Smartphones should be banned in schools.", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "The gig economy exploits workers more than it empowers them.", "tier": "medium", "target_skill": "vocab", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Affirmative action does more harm than good.", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Space exploration is a waste of money when people are suffering on Earth.", "tier": "medium", "target_skill": "confidence", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Universal Basic Income would do more harm than good.", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Zoos should be abolished.", "tier": "easy", "target_skill": "delivery", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Social media companies should be legally responsible for content on their platforms.", "tier": "hard", "target_skill": "vocab", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Athletes are paid too much compared to teachers.", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Nuclear energy is the only realistic solution to climate change.", "tier": "hard", "target_skill": "structure", "category": "opinion", "goal_type": "debater"},
    {"id": "fallback", "text": "Cancel culture has gone too far.", "tier": "medium", "target_skill": "confidence", "category": "opinion", "goal_type": "debater"},

    # ── PRESENTATION PRACTICE ────────────────────────────────────────────
    {"id": "fallback", "text": "Present the key benefits and risks of artificial intelligence in three minutes.", "tier": "medium", "target_skill": "structure", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Pitch an app idea that solves a real problem you've personally experienced.", "tier": "easy", "target_skill": "delivery", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Present a data-backed argument for why your city should invest in public transport.", "tier": "hard", "target_skill": "vocab", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Explain to a non-technical audience why cybersecurity matters for individuals.", "tier": "medium", "target_skill": "delivery", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Present the top three things a company should do to improve employee wellbeing.", "tier": "medium", "target_skill": "structure", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Pitch a solution to the problem of food waste in your community.", "tier": "easy", "target_skill": "confidence", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Present the pros and cons of remote work for a company considering going fully remote.", "tier": "medium", "target_skill": "structure", "category": "analytical", "goal_type": "presenter"},
    {"id": "fallback", "text": "Explain the business case for investing in renewable energy.", "tier": "hard", "target_skill": "vocab", "category": "analytical", "goal_type": "presenter"},

    # ── PUBLIC SPEAKING / ORATOR ─────────────────────────────────────────
    {"id": "fallback", "text": "Give a motivational 90-second speech about overcoming fear.", "tier": "medium", "target_skill": "delivery", "category": "opinion", "goal_type": "orator"},
    {"id": "fallback", "text": "Speak passionately about a cause you genuinely care about.", "tier": "easy", "target_skill": "confidence", "category": "opinion", "goal_type": "orator"},
    {"id": "fallback", "text": "Deliver a short speech convincing someone to take a leap of faith in their career.", "tier": "medium", "target_skill": "delivery", "category": "opinion", "goal_type": "orator"},
    {"id": "fallback", "text": "Give a speech about what your generation owes to the next one.", "tier": "hard", "target_skill": "vocab", "category": "opinion", "goal_type": "orator"},
    {"id": "fallback", "text": "Speak about a time resilience changed everything for you or someone you know.", "tier": "medium", "target_skill": "delivery", "category": "storytelling", "goal_type": "orator"},
    {"id": "fallback", "text": "Convince an audience that small daily actions matter more than grand gestures.", "tier": "easy", "target_skill": "structure", "category": "opinion", "goal_type": "orator"},
    {"id": "fallback", "text": "Give a 90-second talk about why education needs to be reinvented.", "tier": "hard", "target_skill": "delivery", "category": "opinion", "goal_type": "orator"},

    # ── ANALYTICAL / CREATIVE ────────────────────────────────────────────
    {"id": "fallback", "text": "If you could redesign one thing about the education system, what would it be and why?", "tier": "medium", "target_skill": "structure", "category": "analytical", "goal_type": "general"},
    {"id": "fallback", "text": "If you had $1 million to spend solving one problem in your city, what would you do?", "tier": "medium", "target_skill": "delivery", "category": "analytical", "goal_type": "general"},
    {"id": "fallback", "text": "What does the ideal workplace look like in 2030?", "tier": "medium", "target_skill": "vocab", "category": "analytical", "goal_type": "general"},
    {"id": "fallback", "text": "If you could give one piece of advice to your 16-year-old self, what would it be and why?", "tier": "easy", "target_skill": "delivery", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "Describe your perfect Saturday and what it reveals about your values.", "tier": "easy", "target_skill": "confidence", "category": "storytelling", "goal_type": "general"},
    {"id": "fallback", "text": "If you could eliminate one social problem overnight, which would you choose and why?", "tier": "hard", "target_skill": "structure", "category": "analytical", "goal_type": "general"},
    {"id": "fallback", "text": "What does true confidence look like, and how do you build it?", "tier": "medium", "target_skill": "vocab", "category": "opinion", "goal_type": "general"},
    {"id": "fallback", "text": "Explain a complex topic you understand well to someone who has never heard of it.", "tier": "hard", "target_skill": "delivery", "category": "analytical", "goal_type": "general"},
]
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/mp4", "audio/wav", "audio/mpeg", "audio/ogg"
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def detect_audio_format(data: bytes) -> tuple[str, str] | None:
    """Return a trusted content type and extension for a supported audio container."""
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm", "webm"
    if data.startswith(b"RIFF") and data[8:12] == b"WAVE":
        return "audio/wav", "wav"
    if data.startswith(b"OggS"):
        return "audio/ogg", "ogg"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "audio/mp4", "m4a"
    if data.startswith(b"ID3") or data.startswith(b"\xff\xfb") or data.startswith(b"\xff\xf3"):
        return "audio/mpeg", "mp3"
    return None


@router.get("/topic")
@limiter.limit("30/minute")
async def get_topic(
    request: Request,
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
                .limit(50)
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
        "id": chosen.get("id", "fallback"),
        "text": chosen["text"],
        "tier": chosen.get("tier", "medium"),
        "difficulty": chosen.get("tier", "medium"),
        "target_skill": chosen.get("target_skill", "general"),
        "category": chosen.get("category", "opinion"),
        "goal_type": chosen.get("goal_type", "general"),
    }


@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_session(
    request: Request,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    topic_id: str = Form(...),
    topic_text: str = Form(...),
    speaking_goal: Optional[str] = Form(None),
    difficulty_tier: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    content_type = (audio.content_type or "").split(";", 1)[0].lower()
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Recording too short.")
    detected_audio = detect_audio_format(audio_bytes)
    if not detected_audio:
        raise HTTPException(status_code=400, detail="The upload is not a supported audio file.")
    detected_content_type, extension = detected_audio

    session_id = str(uuid.uuid4())
    audio_url = None

    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    normalized_goal = normalize_goal(speaking_goal)
    normalized_difficulty = normalize_difficulty(difficulty_tier)
    # Sanitize topic_text — strip control chars, enforce max length
    topic_text = topic_text.strip()[:300] if topic_text else "General speaking practice"
    topic_text = "".join(c for c in topic_text if c >= " " or c in "\n\r\t")

    try:
        from config import get_db
        db = get_db()
        storage_path = f"sessions/{session_id}/recording.{extension}"
        db.storage.from_("audio-recordings").upload(
            path=storage_path, file=audio_bytes,
            file_options={"content-type": detected_content_type},
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
        raise HTTPException(status_code=500, detail="Unable to save your recording. Please try again.")

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
    except Exception:
        user_profile = None

    try:
        from analysis.pipeline import run_analysis_pipeline
        logger.info(f"[sessions] Starting pipeline for {session_id[:8]}")
        await asyncio.wait_for(
            run_analysis_pipeline(
                session_id=session_id,
                audio_bytes=audio_bytes,
                topic=topic_text,
                user_profile=user_profile,
                session_number=(user_profile.get("total_sessions") or 0) + 1 if user_profile else 1,
                user_id=user_id,
                speaking_goal_override=speaking_goal,
                difficulty_tier=difficulty_tier,
            ),
            timeout=300,  # 5-minute hard cap — marks session as failed if exceeded
        )
    except asyncio.TimeoutError:
        logger.error(f"[sessions] Pipeline TIMEOUT for {session_id} — marking as failed")
        try:
            from config import get_db
            get_db().table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as inner_e:
            logger.error(f"[sessions] Could not mark timed-out session as failed: {inner_e}")
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
            .limit(200)
            .execute()
        )
        return {"sessions": result.data}
    except Exception as e:
        logger.error(f"[sessions] list failed: {e}")
        return {"sessions": []}


@router.get("/{session_id}")
@limiter.limit("30/minute")
async def get_session(request: Request, session_id: str, authorization: Optional[str] = Header(None)):
    try:
        from config import get_db
        db = get_db()
        user_id = get_user_id(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        if session_id == "latest":
            # fetch the actual latest completed session for this user
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
                .eq("user_id", user_id)
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
        raise HTTPException(status_code=500, detail="Unable to load this session. Please try again.")
@router.get("/{session_id}/transcript")
@limiter.limit("30/minute")
async def get_transcript(request: Request, session_id: str, authorization: Optional[str] = Header(None)):
    """
    Returns the full transcript with word-level timestamps and semantic labels.
    Used by the interactive Results page for word highlighting and audio sync.
    """
    try:
        from config import get_db
        db = get_db()
        user_id = get_user_id(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        result = (
            db.table("session_metrics")
            .select("words, filler_positions, sessions!inner(user_id)")
            .eq("session_id", session_id)
            .eq("sessions.user_id", user_id)
            .limit(1)
            .execute()
        )

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Transcript not found")

        metrics = result.data[0]

        # Parse JSON fields
        import json
        words_raw = metrics.get("words")
        words = json.loads(words_raw) if isinstance(words_raw, str) else (words_raw or [])

        filler_positions_raw = metrics.get("filler_positions")
        filler_positions = json.loads(filler_positions_raw) if isinstance(filler_positions_raw, str) else (filler_positions_raw or [])

        # Create a set of filler word positions for fast lookup
        filler_indices = {f["position"] for f in filler_positions if isinstance(f, dict) and "position" in f}

        # Add semantic type to each word
        transcript_words = []
        for idx, word_obj in enumerate(words):
            if not isinstance(word_obj, dict):
                continue
            transcript_words.append({
                "word": word_obj.get("word", ""),
                "start": word_obj.get("start", 0),
                "end": word_obj.get("end", 0),
                "type": "filler" if idx in filler_indices else "normal"
            })

        logger.info(f"[sessions] Transcript for {session_id}: {len(transcript_words)} words")
        return transcript_words

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[sessions] transcript fetch failed {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to load this transcript. Please try again.")


@router.get("/{session_id}/audio-url")
@limiter.limit("20/minute")
async def get_audio_url(request: Request, session_id: str, authorization: Optional[str] = Header(None)):
    """
    Returns a signed URL for the audio file stored in Supabase storage.
    The URL is valid for 1 hour and allows the frontend to play the audio.
    """
    try:
        from config import get_db
        db = get_db()
        user_id = get_user_id(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Fetch the session to get the audio_url path
        result = (
            db.table("sessions")
            .select("audio_url")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Session not found")

        audio_path = result.data[0].get("audio_url")
        if not audio_path:
            raise HTTPException(status_code=404, detail="Audio file not found")

        # Generate a signed URL valid for 1 hour (3600 seconds)
        signed_url = db.storage.from_("audio-recordings").create_signed_url(
            audio_path,
            expires_in=3600
        )

        logger.info(f"[sessions] Generated signed URL for {session_id}")
        return {"url": signed_url["signedURL"]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[sessions] audio URL generation failed {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to prepare the audio playback. Please try again.")
