from fastapi import APIRouter, Depends, Request
from fastapi import Header, HTTPException
from auth import get_current_user
from pydantic import BaseModel
from typing import Any, Optional
import json
import logging
from datetime import date, datetime, timedelta
from config import get_db
from routers.utils import get_user_id_from_token as get_user_id
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


GOAL_ALIASES = {
    "general": "general",
    "public speaking": "orator",
    "public_speaking": "orator",
    "orator": "orator",
    "speech": "orator",
    "speaking": "orator",
    "presentations": "presenter",
    "presentation": "presenter",
    "presenter": "presenter",
    "interviews": "interviewer",
    "interview": "interviewer",
    "interviewer": "interviewer",
    "debates": "debater",
    "debate": "debater",
    "debater": "debater",
}

DIFFICULTY_ALIASES = {
    "easy": "beginner",
    "beginner": "beginner",
    "medium": "intermediate",
    "intermediate": "intermediate",
    "hard": "advanced",
    "advanced": "advanced",
}

DEFAULT_APPEARANCE = {
    "accentColor": "green",
    "uiDensity": "Comfortable",
    "roundedCorners": 24,
}

DEFAULT_NOTIFICATIONS = {
    "dailyReminder": True,
    "weeklyReport": True,
    "achievements": True,
    "sessionCompletion": True,
    "streakAlerts": True,
    "email": False,
    "push": True,
}

DEFAULT_AUDIO = {
    "mic": "Default Microphone (Built-in Audio)",
    "noiseCancellation": True,
    "sensitivity": 75,
    "autoGain": True,
    "quality": "HD 256kbps Studio",
    "voiceEnhancement": True,
    "livePreview": False,
}

DEFAULT_INTEGRATIONS = {
    "gcal": True,
    "gdrive": False,
    "notion": True,
    "slack": False,
    "zoom": True,
    "teams": False,
}


def normalize_goal(value: Optional[str]) -> str:
    if not value:
        return "general"
    return GOAL_ALIASES.get(str(value).strip().lower().replace("-", " "), "general")


def normalize_difficulty(value: Optional[str]) -> str:
    if not value:
        return "beginner"
    return DIFFICULTY_ALIASES.get(str(value).strip().lower().replace("-", " "), "beginner")


def clean_display_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned[:80] if cleaned else None


def merge_json(defaults: dict[str, Any], value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        value = {}
    return {**defaults, **value}


def parse_json_list(value: Any) -> list:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return []
    return value if isinstance(value, list) else []


def week_start(today: Optional[date] = None) -> date:
    d = today or date.today()
    return d - timedelta(days=d.weekday())


def parse_session_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return date.fromisoformat(value.split("T")[0])
        except Exception:
            return None


def friendly_goal(goal: str) -> str:
    return {
        "orator": "Public Speaking",
        "presenter": "Presentations",
        "interviewer": "Interview",
        "debater": "Debate",
        "general": "Speaking",
    }.get(goal, "Speaking")


def preferred_pace_label(goal: str, difficulty: str) -> str:
    ranges = {
        "orator": {
            "beginner": "Measured (105 - 135 WPM)",
            "intermediate": "Expressive (105 - 155 WPM)",
            "advanced": "Dynamic (100 - 165 WPM)",
        },
        "presenter": {
            "beginner": "Clear (115 - 145 WPM)",
            "intermediate": "Business Clear (115 - 155 WPM)",
            "advanced": "Executive (120 - 165 WPM)",
        },
        "interviewer": {
            "beginner": "Calm (115 - 145 WPM)",
            "intermediate": "Conversational (120 - 160 WPM)",
            "advanced": "Concise (125 - 165 WPM)",
        },
        "debater": {
            "beginner": "Controlled (130 - 165 WPM)",
            "intermediate": "Assertive (140 - 185 WPM)",
            "advanced": "High-Clarity Fast (150 - 195 WPM)",
        },
        "general": {
            "beginner": "Steady (115 - 145 WPM)",
            "intermediate": "Balanced (120 - 160 WPM)",
            "advanced": "Flexible (120 - 170 WPM)",
        },
    }
    return ranges.get(goal, ranges["general"]).get(difficulty, ranges["general"]["beginner"])


def focus_from_scores(scores: dict[str, int]) -> str:
    if not scores:
        return "confidence"
    return min(scores.items(), key=lambda item: item[1])[0]


def build_dashboard_recommendations(
    sessions_data: list[dict[str, Any]],
    profile: dict[str, Any],
) -> dict[str, Any]:
    goal = normalize_goal(profile.get("speaking_goal"))
    difficulty = normalize_difficulty(profile.get("difficulty_tier"))
    total_sessions = len(sessions_data)
    latest_scores = sessions_data[-1]["scores"] if sessions_data else {}
    first_scores = sessions_data[0]["scores"] if sessions_data else {}
    weak_skill = focus_from_scores(latest_scores) if latest_scores else "structure"
    current_streak = profile.get("current_streak", 0)

    # Compute best scores across all sessions
    best_scores: dict[str, int] = {}
    for dim in ("filler", "delivery", "structure", "vocab", "confidence"):
        vals = [s["scores"].get(dim, 0) for s in sessions_data if s.get("scores")]
        best_scores[dim] = max(vals) if vals else 0

    # Average of latest session
    avg_latest = (
        sum(latest_scores.values()) / len(latest_scores)
        if latest_scores else 0
    )

    focus_titles = {
        "filler": "Filler Control",
        "delivery": "Delivery Precision",
        "structure": "Answer Structure",
        "vocab": "Vocabulary Range",
        "confidence": "Confidence",
    }
    focus_actions = {
        "filler":     "Record one answer and replace every filler with a silent one-count pause.",
        "delivery":   "Practice the same answer three times: calm, energetic, then authoritative.",
        "structure":  "Use a clear beginning, two proof points, and a one-sentence close.",
        "vocab":      "Replace vague words with concrete verbs and specific examples.",
        "confidence": "Start with your conclusion first, then explain why in two concise points.",
    }

    goal_tags = {
        "orator":      ["Storytelling", "Presence", "Audience Impact"],
        "presenter":   ["Clear Takeaway", "Evidence", "Transitions"],
        "interviewer": ["STAR Structure", "Ownership", "Concise Impact"],
        "debater":     ["Claim-Evidence-Impact", "Rebuttal", "Logical Clarity"],
        "general":     ["Clarity", "Pacing", "Structure"],
    }

    # Goal-specific tailored suggestions
    goal_suggestions = {
        "orator": [
            {"title": "Dramatic Pause Drill", "desc": "Practice placing a 2-second pause before your most important point for maximum rhetorical impact.", "tag": "Orator Skill"},
            {"title": "Rule of Three Exercise", "desc": "Restate your key argument three times using different words. Lock it into your audience's memory.", "tag": "Storytelling"},
        ],
        "debater": [
            {"title": "Claim-Evidence-Impact", "desc": "State your claim, back it with a fact or example, then explain the impact. Repeat 3 times.", "tag": "Debate Method"},
            {"title": "Rebuttal Speed Drill", "desc": "Give a 30-second counter-argument to any position you disagree with. Time yourself.", "tag": "Quick Thinking"},
        ],
        "presenter": [
            {"title": "Slide Transition Script", "desc": "Write out your exact words for each slide transition. Smooth transitions define elite presenters.", "tag": "Presenter Pro"},
            {"title": "One-Sentence Takeaway", "desc": "Distill your entire presentation into a single memorable sentence. Practice saying it naturally.", "tag": "Clarity"},
        ],
        "interviewer": [
            {"title": "STAR Answer Builder", "desc": "Pick a recent win and structure it: Situation → Task → Action → Result. Keep it under 90 seconds.", "tag": "STAR Method"},
            {"title": "Ownership Language", "desc": "Replace every 'we' with 'I' when describing your contributions. Own your impact clearly.", "tag": "Confidence"},
        ],
        "general": [
            {"title": "Consistency Builder", "desc": "Complete one short session today to keep your learning loop active.", "tag": "Habit"},
            {"title": "Progress Review", "desc": "Compare your latest session against your previous attempt.", "tag": "Insight"},
        ],
    }

    base_suggestions = [
        {"title": "Targeted Drill", "desc": focus_actions.get(weak_skill, focus_actions["structure"]), "tag": "Recommended"},
        {"title": f"{friendly_goal(goal)} Mode", "desc": "Practice with scoring calibrated to your speaking goal.", "tag": "Mode"},
    ]
    extra_suggestions = goal_suggestions.get(goal, goal_suggestions["general"])
    all_suggestions = (base_suggestions + extra_suggestions)[:4]

    # ── Achievement System (fully data-driven) ──────────────────────────
    # Each achievement: id, icon, title, desc, unlocked (bool), progress (0-100), text_progress
    filler_improvement = (
        first_scores.get("filler", 0) - latest_scores.get("filler", 0)
        if total_sessions >= 2 else 0
    )
    achievements = [
        {
            "id": "first_session",
            "icon": "🎤",
            "title": "First Step",
            "desc": "Completed your very first session",
            "unlocked": total_sessions >= 1,
            "progress": 100 if total_sessions >= 1 else 0,
            "text_progress": "1/1 session" if total_sessions >= 1 else "0/1 session",
        },
        {
            "id": "streak_7",
            "icon": "🔥",
            "title": "7-Day Streak",
            "desc": "Practice for 7 days in a row",
            "unlocked": current_streak >= 7,
            "progress": min(100, int((current_streak / 7) * 100)),
            "text_progress": f"{min(current_streak, 7)}/7 days",
        },
        {
            "id": "sessions_10",
            "icon": "⭐",
            "title": "Rising Speaker",
            "desc": "Complete 10 sessions",
            "unlocked": total_sessions >= 10,
            "progress": min(100, int((total_sessions / 10) * 100)),
            "text_progress": f"{min(total_sessions, 10)}/10 sessions",
        },
        {
            "id": "high_score",
            "icon": "🏆",
            "title": "Excellence Award",
            "desc": "Achieve an average score of 85+ in any session",
            "unlocked": avg_latest >= 85,
            "progress": min(100, int((avg_latest / 85) * 100)),
            "text_progress": f"{int(avg_latest)}/85 avg score",
        },
        {
            "id": "filler_master",
            "icon": "🎯",
            "title": "Filler Slayer",
            "desc": "Filler control score above 80",
            "unlocked": best_scores.get("filler", 0) >= 80,
            "progress": min(100, int((best_scores.get("filler", 0) / 80) * 100)),
            "text_progress": f"{best_scores.get('filler', 0)}/80 filler score",
        },
        {
            "id": "sessions_30",
            "icon": "🚀",
            "title": "Transformation Champion",
            "desc": "Complete the 30-day speaking challenge",
            "unlocked": total_sessions >= 30,
            "progress": min(100, int((total_sessions / 30) * 100)),
            "text_progress": f"{min(total_sessions, 30)}/30 sessions",
        },
        {
            "id": "streak_30",
            "icon": "💎",
            "title": "Unstoppable",
            "desc": "30-day speaking streak",
            "unlocked": current_streak >= 30,
            "progress": min(100, int((current_streak / 30) * 100)),
            "text_progress": f"{min(current_streak, 30)}/30 days",
        },
        {
            "id": "goal_specific",
            "icon": {"orator": "🎭", "debater": "⚔️", "presenter": "📊", "interviewer": "💼"}.get(goal, "✨"),
            "title": {"orator": "Born Orator", "debater": "Master Debater", "presenter": "Pitch Perfect", "interviewer": "Interview Champion"}.get(goal, "Speaking Champion"),
            "desc": f"Reach Advanced level in {friendly_goal(goal)} mode",
            "unlocked": total_sessions >= 15 and avg_latest >= 80,
            "progress": min(100, int(((total_sessions / 15) * 50 + (avg_latest / 80) * 50))),
            "text_progress": f"{min(total_sessions, 15)}/15 sessions at 80+ score",
        },
    ]

    return {
        "today_focus": {
            "title": f"{friendly_goal(goal)} {focus_titles.get(weak_skill, 'Practice')}",
            "description": focus_actions.get(weak_skill, focus_actions["structure"]),
            "skill": weak_skill,
            "tags": goal_tags.get(goal, goal_tags["general"]),
            "estimated_minutes": 1,
        },
        "profile_badge": f"{friendly_goal(goal)} Mastery • {difficulty.title()} Journey",
        "suggestions": all_suggestions,
        "achievements": achievements,
    }


@router.get("/stats")
@limiter.limit("30/minute")
async def get_dashboard_stats(request: Request, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        # Return an empty dashboard state for unauthenticated requests
        return {
            "total_sessions": 0, "current_streak": 0, "longest_streak": 0,
            "sessions": [], "improvements": {}, "top_fillers": [],
            "best_session": {"date": None, "avg_score": 0},
            "display_name": "",
            "speaking_goal": "general",
            "difficulty_tier": "beginner",
            "weekly_goal": {"completed": 0, "target": 7, "percent": 0, "remaining": 7},
            "mini_insights": {
                "confidence": 0, "vocab": 0, "delivery": 0, "structure": 0,
                "has_enough_data": False,
            },
            "today_focus": build_dashboard_recommendations([], {})["today_focus"],
            "profile_badge": "Speaking Mastery • Beginner Journey",
            "suggestions": build_dashboard_recommendations([], {})["suggestions"],
            "achievements": [],
        }

    db = get_db()
    profile: dict[str, Any] = {}

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
    # Bug fix: count ALL completed sessions upfront — not just those with parseable scores
    total_sessions = len(raw_sessions)
    best_session = {"date": None, "avg_score": 0}
    first_scores = None
    last_scores = None

    start_of_week = week_start()
    sessions_this_week = 0

    for idx, s in enumerate(raw_sessions, start=1):
        metrics = s.get("session_metrics", [])
        if isinstance(metrics, dict):
            metrics = [metrics]

        scores = {}
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

        # Bug fix: handle both coaching_prompt key names and legacy aliases
        # coaching_prompt emits: overall, delivery, vocabulary, filler_control, structure
        # dashboard historically expected: filler, delivery, structure, vocab, confidence
        resolved_scores = {
            "filler":     scores.get("filler", 0) or scores.get("filler_control", 0),
            "delivery":   scores.get("delivery", 0),
            "structure":  scores.get("structure", 0),
            "vocab":      scores.get("vocab", 0) or scores.get("vocabulary", 0),
            "confidence": scores.get("confidence", 0) or scores.get("overall", 0),
        }

        duration = metrics[0].get("duration_secs", 0) if metrics else 0
        session_obj = {
            "session_number": idx,
            "id": s.get("id", ""),
            "date": s.get("created_at", "").split("T")[0] if s.get("created_at") else "",
            "topic": s.get("topic_text", ""),
            "duration_secs": duration,
            "scores": resolved_scores,
        }
        sessions_data.append(session_obj)
        session_date = parse_session_date(s.get("created_at"))
        if session_date and session_date >= start_of_week:
            sessions_this_week += 1

        # Only update first/last scores when we actually have score data
        if any(resolved_scores.values()):
            if not first_scores:
                first_scores = resolved_scores
            last_scores = resolved_scores

        avg_score = sum(resolved_scores.values()) / 5.0
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
        top_fillers = parse_json_list(top_fillers)
    except Exception:
        top_fillers = []

    weekly_target = 7
    weekly_percent = int(min(100, round((sessions_this_week / weekly_target) * 100)))
    remaining_weekly = max(0, weekly_target - sessions_this_week)
    mini_insights = {
        "confidence": 0,
        "vocab": 0,
        "delivery": 0,
        "structure": 0,
        "has_enough_data": False,
    }
    if len(sessions_data) >= 2:
        current = sessions_data[-1]["scores"]
        previous = sessions_data[-2]["scores"]
        mini_insights = {
            "confidence": current.get("confidence", 0) - previous.get("confidence", 0),
            "vocab": current.get("vocab", 0) - previous.get("vocab", 0),
            "delivery": current.get("delivery", 0) - previous.get("delivery", 0),
            "structure": current.get("structure", 0) - previous.get("structure", 0),
            "has_enough_data": True,
        }

    dashboard_guidance = build_dashboard_recommendations(
        sessions_data,
        {**profile, "current_streak": current_streak},
    )

    return {
        "total_sessions": total_sessions,
        "current_streak":  current_streak,
        "longest_streak":  longest_streak,
        "sessions":        sessions_data,
        "improvements":    improvements,
        "top_fillers":     top_fillers,
        "best_session":    best_session,
        "display_name":    profile.get("display_name", ""),
        "speaking_goal":   normalize_goal(profile.get("speaking_goal")),
        "difficulty_tier": normalize_difficulty(profile.get("difficulty_tier")),
        "coaching_style":  profile.get("coaching_style", "Balanced"),
        "feedback_detail": profile.get("feedback_detail", "Detailed"),
        "weekly_goal": {
            "completed": sessions_this_week,
            "target": weekly_target,
            "percent": weekly_percent,
            "remaining": remaining_weekly,
        },
        "mini_insights": mini_insights,
        **dashboard_guidance,
    }


@router.get("/streak")
@limiter.limit("30/minute")
async def get_dashboard_streak(request: Request, authorization: Optional[str] = Header(None)):
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


@router.post("/recalculate-streak")
@limiter.limit("5/minute")
async def recalculate_streak(request: Request, authorization: Optional[str] = Header(None)):
    """Recalculate streak from scratch based on all completed sessions.
    Use this to fix streak showing 0 when sessions exist."""
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        from services.streak_service import StreakService
        svc = StreakService(db)
        await svc.recalculate_streak_from_history(user_id)

        # Return updated streak
        streak_result = db.table('streaks').select('*').eq('user_id', user_id).execute()
        streak = streak_result.data[0] if streak_result.data else {}
        return {
            "success": True,
            "current_streak": streak.get("current_streak", 0),
            "longest_streak": streak.get("longest_streak", 0),
            "total_sessions": streak.get("total_sessions", 0),
        }
    except Exception as e:
        logger.error(f"[recalculate-streak] Failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to recalculate streak")


class OnboardingData(BaseModel):
    speaking_goal: Optional[str] = None
    display_name: Optional[str] = None
    difficulty_tier: Optional[str] = None
    recording_duration_secs: Optional[int] = 60
    coaching_style: Optional[str] = None
    feedback_detail: Optional[str] = None
    appearance_preferences: Optional[dict[str, Any]] = None
    notification_preferences: Optional[dict[str, Any]] = None
    audio_preferences: Optional[dict[str, Any]] = None
    integrations_preferences: Optional[dict[str, Any]] = None


class PreferencesData(BaseModel):
    display_name: Optional[str] = None
    speaking_goal: Optional[str] = None
    difficulty_tier: Optional[str] = None
    recording_duration_secs: Optional[int] = None
    coaching_style: Optional[str] = None
    feedback_detail: Optional[str] = None
    appearance_preferences: Optional[dict[str, Any]] = None
    notification_preferences: Optional[dict[str, Any]] = None
    audio_preferences: Optional[dict[str, Any]] = None
    integrations_preferences: Optional[dict[str, Any]] = None


def build_profile_update(data: OnboardingData | PreferencesData, mark_complete: bool = True) -> dict[str, Any]:
    update_data: dict[str, Any] = {}
    if data.speaking_goal is not None:
        update_data["speaking_goal"] = normalize_goal(data.speaking_goal)
    if data.display_name is not None:
        update_data["display_name"] = clean_display_name(data.display_name)
    if data.difficulty_tier is not None:
        update_data["difficulty_tier"] = normalize_difficulty(data.difficulty_tier)
    if data.recording_duration_secs is not None:
        update_data["recording_duration_secs"] = max(30, min(int(data.recording_duration_secs), 300))
    if data.coaching_style is not None:
        update_data["coaching_style"] = data.coaching_style if data.coaching_style in {"Encouraging", "Balanced", "Strict"} else "Balanced"
    if data.feedback_detail is not None:
        update_data["feedback_detail"] = data.feedback_detail if data.feedback_detail in {"Basic", "Detailed", "Expert"} else "Detailed"
    if data.appearance_preferences is not None:
        update_data["appearance_preferences"] = merge_json(DEFAULT_APPEARANCE, data.appearance_preferences)
    if data.notification_preferences is not None:
        update_data["notification_preferences"] = merge_json(DEFAULT_NOTIFICATIONS, data.notification_preferences)
    if data.audio_preferences is not None:
        update_data["audio_preferences"] = merge_json(DEFAULT_AUDIO, data.audio_preferences)
    if data.integrations_preferences is not None:
        update_data["integrations_preferences"] = merge_json(DEFAULT_INTEGRATIONS, data.integrations_preferences)
    if mark_complete:
        update_data["onboarding_complete"] = True
    return update_data


def resilient_profile_write(db, user_id: str, update_data: dict[str, Any]) -> None:
    """Write profile data while tolerating older Supabase schemas missing new JSONB columns."""
    profile_result = (
        db.table("user_profiles")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    def write(payload: dict[str, Any]) -> None:
        if profile_result.data:
            db.table("user_profiles").update(payload).eq("user_id", user_id).execute()
        else:
            db.table("user_profiles").insert({"user_id": user_id, **payload}).execute()

    try:
        write(update_data)
        return
    except Exception as exc:
        optional_keys = {
            "appearance_preferences",
            "notification_preferences",
            "audio_preferences",
            "coaching_style",
            "feedback_detail",
            "integrations_preferences"
        }
        core_payload = {k: v for k, v in update_data.items() if k not in optional_keys}
        if not core_payload:
            raise exc
        logger.warning("[dashboard] profile write retried without optional columns: %s", exc)
        write(core_payload)


@router.post("/onboarding")
@limiter.limit("20/minute")
async def save_onboarding(
    request: Request,
    data: OnboardingData,
    authorization: Optional[str] = Header(None),
):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    update_data = build_profile_update(data, mark_complete=True)
    if "speaking_goal" not in update_data:
        update_data["speaking_goal"] = "general"
    if "difficulty_tier" not in update_data:
        update_data["difficulty_tier"] = "beginner"
    resilient_profile_write(db, user_id, update_data)

    return {
        "status": "ok",
        "speaking_goal": update_data.get("speaking_goal", "general"),
        "difficulty_tier": update_data.get("difficulty_tier", "beginner"),
        "display_name": update_data.get("display_name"),
    }


@router.patch("/preferences")
@limiter.limit("20/minute")
async def save_preferences(
    request: Request,
    data: PreferencesData,
    authorization: Optional[str] = Header(None),
):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    update_data = build_profile_update(data, mark_complete=False)
    if not update_data:
        return {"status": "ok", "updated": []}

    db = get_db()
    resilient_profile_write(db, user_id, update_data)
    return {"status": "ok", "updated": list(update_data.keys())}


@router.get("/profile-status")
@limiter.limit("30/minute")
async def get_profile_status(request: Request, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        return {
            "onboarding_complete": False,
            "speaking_goal": "general",
            "difficulty_tier": "beginner",
            "appearance_preferences": DEFAULT_APPEARANCE,
            "notification_preferences": DEFAULT_NOTIFICATIONS,
            "audio_preferences": DEFAULT_AUDIO,
        }

    db = get_db()
    try:
        result = (
            db.table("user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {
                "onboarding_complete": True,
                "speaking_goal": "general",
                "difficulty_tier": "beginner",
                "appearance_preferences": DEFAULT_APPEARANCE,
                "notification_preferences": DEFAULT_NOTIFICATIONS,
                "audio_preferences": DEFAULT_AUDIO,
                "integrations_preferences": DEFAULT_INTEGRATIONS,
            }

        profile = result.data[0]
        is_complete = profile.get("onboarding_complete")
        if is_complete is None or is_complete is False:
            is_complete = True

        goal = normalize_goal(profile.get("speaking_goal"))
        difficulty = normalize_difficulty(profile.get("difficulty_tier"))

        return {
            "onboarding_complete":    is_complete,
            "speaking_goal":          goal,
            "display_name":           profile.get("display_name"),
            "difficulty_tier":        difficulty,
            "recording_duration_secs": profile.get("recording_duration_secs", 60),
            "total_sessions":         profile.get("total_sessions", 0),
            "coaching_style":         profile.get("coaching_style", "Balanced"),
            "feedback_detail":        profile.get("feedback_detail", "Detailed"),
            "appearance_preferences": merge_json(DEFAULT_APPEARANCE, profile.get("appearance_preferences")),
            "notification_preferences": merge_json(DEFAULT_NOTIFICATIONS, profile.get("notification_preferences")),
            "audio_preferences": merge_json(DEFAULT_AUDIO, profile.get("audio_preferences")),
            "integrations_preferences": merge_json(DEFAULT_INTEGRATIONS, profile.get("integrations_preferences")),
            "preferred_pace_label": preferred_pace_label(goal, difficulty),
            "preferred_feedback_label": f"{profile.get('feedback_detail', 'Detailed')} / {profile.get('coaching_style', 'Balanced')}",
        }
    except Exception as e:
        logger.error(f"[dashboard] profile-status error: {e}")
        return {
            "onboarding_complete": True,
            "speaking_goal": "general",
            "difficulty_tier": "beginner",
            "appearance_preferences": DEFAULT_APPEARANCE,
            "notification_preferences": DEFAULT_NOTIFICATIONS,
            "audio_preferences": DEFAULT_AUDIO,
            "integrations_preferences": DEFAULT_INTEGRATIONS,
        }


@router.get("/export")
@limiter.limit("5/minute")
async def export_user_data(request: Request, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        stats = await get_dashboard_stats(authorization)
        profile = (
            db.table("user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data
        sessions = (
            db.table("sessions")
            .select("id, topic_text, created_at, status, session_metrics(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        ).data
        summaries = (
            db.table("session_summaries")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        ).data
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "profile": profile[0] if profile else {},
            "stats": stats,
            "sessions": sessions or [],
            "ai_memory": summaries or [],
        }
    except Exception as e:
        logger.error("[dashboard] export failed: %s", e)
        raise HTTPException(status_code=500, detail="Data export failed. Please try again.")


@router.delete("/purge-audio")
@limiter.limit("5/minute")
async def purge_audio_recordings(request: Request, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        # Get all session IDs for this user to delete from storage
        sessions_result = db.table("sessions").select("id").eq("user_id", user_id).execute()
        session_ids = [s["id"] for s in (sessions_result.data or [])]

        # Delete audio files from storage (not the session records themselves)
        for sid in session_ids:
            try:
                db.storage.from_("audio-recordings").remove([f"sessions/{sid}/recording.webm"])
            except Exception as storage_e:
                logger.warning(f"[dashboard] Could not delete audio for session {sid}: {storage_e}")

        return {"status": "ok", "message": f"Purged audio recordings for {len(session_ids)} sessions"}
    except Exception as e:
        logger.error("[dashboard] purge audio failed: %s", e)
        raise HTTPException(status_code=500, detail="Audio purge failed. Please try again.")


@router.post("/reset-personalization")
@limiter.limit("5/minute")
async def reset_personalization(request: Request, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        db.table("session_summaries").delete().eq("user_id", user_id).execute()
        db.table("drill_completions").delete().eq("user_id", user_id).execute()
        db.table("user_profiles").update({
            "filler_score": None,
            "delivery_score": None,
            "structure_score": None,
            "vocab_score": None,
            "confidence_score": None,
            "filler_trend": "stable",
            "last_coached": None,
            "coached_on": [],
            "top_fillers": [],
        }).eq("user_id", user_id).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error("[dashboard] reset personalization failed: %s", e)
        raise HTTPException(status_code=500, detail="Unable to reset personalization memory. Please try again.")


class PushSubscriptionData(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

@router.post("/push-subscribe")
@limiter.limit("10/minute")
async def save_push_subscription(request: Request, data: PushSubscriptionData, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    db = get_db()
    try:
        # Upsert the push subscription
        payload = {
            "user_id": user_id,
            "endpoint": data.endpoint,
            "p256dh": data.p256dh,
            "auth": data.auth
        }
        db.table("push_subscriptions").upsert(payload).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"[dashboard] push-subscribe failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save push subscription")

class DrillCompletionData(BaseModel):
    session_id: str
    drill_text: str
    drill_type: str = "daily_drill"
    self_rating: Optional[int] = None


@router.post("/complete-drill")
@limiter.limit("20/minute")
async def complete_drill_endpoint(
    request: Request,
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
