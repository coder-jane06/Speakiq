from fastapi import APIRouter, Header
from typing import Optional
import jwt
from config import get_db
import logging
from datetime import date

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
        # For development, allow unauthenticated access 
        user_id = "00000000-0000-0000-0000-000000000000"
    
    db = get_db()
    
    # Get streak
    try:
        streak_result = db.table('streaks').select('*').eq('user_id', user_id).execute()
        streak = streak_result.data[0] if streak_result.data else None
    except Exception:
        streak = None
        
    current_streak = streak["current_streak"] if streak else 0
    longest_streak = streak["longest_streak"] if streak else 0
    
    # Get all sessions with metrics
    try:
        sessions_result = db.table("sessions")\
            .select("id, topic_text, created_at, status, session_metrics(*)")\
            .eq("user_id", user_id)\
            .eq("status", "complete")\
            .order("created_at", desc=False)\
            .execute()
        raw_sessions = sessions_result.data or []
    except Exception:
        raw_sessions = []
    
    sessions_data = []
    total_sessions = 0
    best_session = {"date": None, "avg_score": 0}
    
    # Track scores for improvement calc
    first_scores = None
    last_scores = None
    
    filler_counts = {}

    import json

    for i, s in enumerate(raw_sessions):
        metrics = s.get("session_metrics", [])
        if isinstance(metrics, dict):
            # Sometimes it comes as a dict when there is no relation cardinality > 1
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
                "filler": scores.get("filler", 0),
                "delivery": scores.get("delivery", 0),
                "structure": scores.get("structure", 0),
                "vocab": scores.get("vocab", 0),
                "confidence": scores.get("confidence", 0)
            }
        }
        sessions_data.append(session_obj)

        if not first_scores:
            first_scores = session_obj["scores"]
        last_scores = session_obj["scores"]
        
        # Calculate avg score
        avg_score = sum(session_obj["scores"].values()) / 5.0
        if avg_score > best_session["avg_score"]:
            best_session["avg_score"] = int(avg_score)
            best_session["date"] = session_obj["date"]
            
    improvements = {
        "filler": {"day1": 0, "today": 0, "change": 0},
        "delivery": {"day1": 0, "today": 0, "change": 0},
        "structure": {"day1": 0, "today": 0, "change": 0},
        "vocab": {"day1": 0, "today": 0, "change": 0},
        "confidence": {"day1": 0, "today": 0, "change": 0}
    }
    
    if first_scores and last_scores:
        for key in improvements:
            d1 = first_scores.get(key, 0)
            t = last_scores.get(key, 0)
            improvements[key] = {
                "day1": d1,
                "today": t,
                "change": t - d1
            }

    # Fetch user_profiles for top_fillers
    try:
        profile_result = db.table("user_profiles").select("*").eq("id", user_id).order("updated_at", desc=True).limit(1).execute()
        profile = profile_result.data[0] if profile_result.data else {}
        top_fillers = profile.get("top_fillers", [])
        if isinstance(top_fillers, str):
            top_fillers = json.loads(top_fillers)
    except Exception:
        top_fillers = []

    return {
        "total_sessions": total_sessions,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "sessions": sessions_data,
        "improvements": improvements,
        "top_fillers": top_fillers,
        "best_session": best_session
    }

@router.get("/streak")
async def get_dashboard_streak(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000000"
        
    db = get_db()
    try:
        streak_result = db.table('streaks').select('*').eq('user_id', user_id).execute()
        streak = streak_result.data[0] if streak_result.data else None
    except Exception:
        streak = None

    current_streak = streak["current_streak"] if streak else 0
    longest_streak = streak["longest_streak"] if streak else 0
    total_sessions = streak["total_sessions"] if streak else 0
    last_session_date = streak.get("last_session_date") if streak else None

    grace_day_available = False
    if total_sessions > 0 and (total_sessions % 7 == 0) and last_session_date:
        last_date = date.fromisoformat(last_session_date)
        today = date.today()
        if (today - last_date).days == 2:
            grace_day_available = True

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_sessions": total_sessions,
        "last_session_date": last_session_date,
        "grace_day_available": grace_day_available
    }
