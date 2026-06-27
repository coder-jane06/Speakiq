from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
import jwt
import json
import logging
from datetime import date
from config import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


def get_user_id(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.replace("Bearer ", "")
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")
    except Exception:
        return None


@router.get("/stats")
async def get_dashboard_stats(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        # Return an empty dashboard state for unauthenticated requests
        return {
            "total_sessions": 0, "current_streak": 0, "longest_streak": 0,
            "sessions": [], "improvements": {}, "top_fillers": [],
            "best_session": {"date": None, "avg_score": 0}
        }

    db = get_db()

    # Get streak
    try:
        streak_result = db.table('streaks').select('*').eq('user_id', user_id).execute()
        streak = streak_result.data[0] if streak_result.data else None
    except Exception:
        streak = None

    current_streak = streak["current_streak"] if streak else 0
    longest_streak = streak["longest_streak"] if streak else 0

    # Get all completed sessions with metrics
    try:
        sessions_result = (
            db.table("sessions")
            .select("id, topic_text, created_at, status, session_metrics(*)")
            .eq("user_id", user_id)
            .eq("status", "complete")
            .order("created_at", desc=False)
            .execute()
        )
        raw_sessions = sessions_result.data or []
    except Exception:
        raw_sessions = []

    sessions_data = []
    total_sessions = 0
    best_session = {"date": None, "avg_score": 0}
    first_scores = None
    last_scores = None

    for s in raw_sessions:
        metrics = s.get("session_metrics", [])
        if isinstance(metrics, dict):
            metrics = [metrics]

        if metrics and len(metrics) > 0:
            coaching_raw = metrics[0].get("coaching_report")
            if isinstance(coaching_raw, str):
                try:
                    coaching = json.loads(coaching_raw)
                except json.JSONDecodeError:
                    coaching = {}
            else:
                coaching = coaching_raw or {}
            scores = coaching.get("scores", {})
        else:
            continue

        if not scores:
            continue

        total_sessions += 1
        session_obj = {
            "session_number": total_sessions,
            "id": s.get("id", ""),
            "date": s.get("created_at", "").split("T")[0] if s.get("created_at") else "",
            "topic": s.get("topic_text", ""),
            "scores": {
                "filler":     scores.get("filler", 0),
                "delivery":   scores.get("delivery", 0),
                "structure":  scores.get("structure", 0),
                "vocab":      scores.get("vocab", 0),
                "confidence": scores.get("confidence", 0),
            },
        }
        sessions_data.append(session_obj)

        if not first_scores:
            first_scores = session_obj["scores"]
        last_scores = session_obj["scores"]

        avg_score = sum(session_obj["scores"].values()) / 5.0
        if avg_score > best_session["avg_score"]:
            best_session["avg_score"] = int(avg_score)
            best_session["date"] = session_obj["date"]

    improvements = {
        dim: {"day1": 0, "today": 0, "change": 0}
        for dim in ("filler", "delivery", "structure", "vocab", "confidence")
    }
    if first_scores and last_scores:
        for key in improvements:
            d1 = first_scores.get(key, 0)
            t  = last_scores.get(key, 0)
            improvements[key] = {"day1": d1, "today": t, "change": t - d1}

    # Fetch top fillers and profile info from user_profiles
    try:
        profile_result = (
            db.table("user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        profile = profile_result.data[0] if profile_result.data else {}
        top_fillers = profile.get("top_fillers", [])
        if isinstance(top_fillers, str):
            top_fillers = json.loads(top_fillers)
    except Exception:
        top_fillers = []

    return {
        "total_sessions": total_sessions,
        "current_streak":  current_streak,
        "longest_streak":  longest_streak,
        "sessions":        sessions_data,
        "improvements":    improvements,
        "top_fillers":     top_fillers,
        "best_session":    best_session,
        "display_name":    profile.get("display_name", "")
    }


@router.get("/streak")
async def get_dashboard_streak(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        return {
            "current_streak": 0, "longest_streak": 0, "total_sessions": 0,
            "last_session_date": None, "grace_day_available": False,
        }

    db = get_db()
    try:
        streak_result = db.table('streaks').select('*').eq('user_id', user_id).execute()
        streak = streak_result.data[0] if streak_result.data else None
    except Exception:
        streak = None

    current_streak    = streak["current_streak"]    if streak else 0
    longest_streak    = streak["longest_streak"]    if streak else 0
    total_sessions    = streak["total_sessions"]    if streak else 0
    last_session_date = streak.get("last_session_date") if streak else None

    grace_day_available = False
    if total_sessions > 0 and (total_sessions % 7 == 0) and last_session_date:
        last_date = date.fromisoformat(last_session_date)
        today = date.today()
        if (today - last_date).days == 2:
            grace_day_available = True

    return {
        "current_streak":     current_streak,
        "longest_streak":     longest_streak,
        "total_sessions":     total_sessions,
        "last_session_date":  last_session_date,
        "grace_day_available": grace_day_available,
    }


class OnboardingData(BaseModel):
    speaking_goal: str = "general"
    display_name: Optional[str] = None
    difficulty_tier: str = "beginner"
    recording_duration_secs: int = 60


@router.post("/onboarding")
async def save_onboarding(
    data: OnboardingData,
    authorization: Optional[str] = Header(None),
):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    profile_result = (
        db.table("user_profiles")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    update_data = {
        "speaking_goal":          data.speaking_goal,
        "display_name":           data.display_name,
        "difficulty_tier":        data.difficulty_tier,
        "recording_duration_secs": data.recording_duration_secs,
        "onboarding_complete":    True,
    }

    if profile_result.data:
        db.table("user_profiles").update(update_data).eq("user_id", user_id).execute()
    else:
        update_data["user_id"] = user_id
        db.table("user_profiles").insert(update_data).execute()

    return {"status": "ok", "speaking_goal": data.speaking_goal}


@router.get("/profile-status")
async def get_profile_status(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        return {"onboarding_complete": False, "speaking_goal": "general"}

    db = get_db()
    try:
        result = (
            db.table("user_profiles")
            .select(
                "speaking_goal, display_name, difficulty_tier, "
                "recording_duration_secs, onboarding_complete, total_sessions"
            )
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            # For registered users without a profile row yet, consider them onboarded
            return {"onboarding_complete": True, "speaking_goal": "general", "total_sessions": 0}

        profile = result.data[0]
        # Registered users with a profile should be considered onboarding_complete = True
        is_complete = profile.get("onboarding_complete")
        if is_complete is None or is_complete is False:
            is_complete = True

        return {
            "onboarding_complete":    is_complete,
            "speaking_goal":          profile.get("speaking_goal", "general"),
            "display_name":           profile.get("display_name"),
            "difficulty_tier":        profile.get("difficulty_tier", "beginner"),
            "recording_duration_secs": profile.get("recording_duration_secs", 60),
            "total_sessions":         profile.get("total_sessions", 0),
        }
    except Exception as e:
        logger.error(f"[dashboard] profile-status error: {e}")
        return {"onboarding_complete": True, "speaking_goal": "general"}


class DrillCompletionData(BaseModel):
    session_id: str
    drill_text: str
    drill_type: str = "daily_drill"
    self_rating: Optional[int] = None


@router.post("/complete-drill")
async def complete_drill_endpoint(
    data: DrillCompletionData,
    authorization: Optional[str] = Header(None),
):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    from services.memory_service import MemoryService

    svc = MemoryService(get_db())
    success = await svc.mark_drill_completed(
        user_id=user_id,
        session_id=data.session_id,
        drill_text=data.drill_text,
        drill_type=data.drill_type,
        self_rating=data.self_rating,
    )
    return {"status": "ok" if success else "error"}
