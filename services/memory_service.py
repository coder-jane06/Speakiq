# =============================================================
# backend/services/memory_service.py
# AI Memory System — stores session summaries and detects patterns
# =============================================================

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class MemoryService:
    """Manages the AI's memory across sessions — summaries, patterns, drill tracking."""

    def __init__(self, db):
        self.db = db

    async def generate_session_summary(
        self,
        session_id: str,
        user_id: str,
        session_number: int,
        topic: str,
        coaching_report,
        nlp_result,
        acoustic_result,
        speaking_goal: str = "general",
    ) -> dict:
        """Generate and store a compact, AI-digestible summary of this session."""
        try:
            scores = {
                "filler": coaching_report.scores.filler,
                "delivery": coaching_report.scores.delivery,
                "structure": coaching_report.scores.structure,
                "vocab": coaching_report.scores.vocab,
                "confidence": coaching_report.scores.confidence,
            }

            # ---------- detect top issues ----------
            top_issues = []
            if nlp_result:
                if getattr(nlp_result, "fillers_per_minute", 0) > 3:
                    top_issues.append("high_filler_rate")
                if getattr(nlp_result, "hedge_word_count", 0) > 3:
                    top_issues.append("excessive_hedge_words")
                if getattr(nlp_result, "ttr_score", 1.0) < 0.4:
                    top_issues.append("low_vocabulary_diversity")
            if acoustic_result:
                if getattr(acoustic_result, "monotony_score", 1.0) < 0.3:
                    top_issues.append("monotone_delivery")
                if getattr(acoustic_result, "longest_pause_sec", 0) > 3:
                    top_issues.append("long_pauses")
                wpm = getattr(acoustic_result, "wpm", 130)
                if wpm > 180:
                    top_issues.append("speaking_too_fast")
                elif wpm < 100:
                    top_issues.append("speaking_too_slow")

            # ---------- build readable summary ----------
            filler_info = ""
            if nlp_result and hasattr(nlp_result, "filler_detail"):
                top_fillers = sorted(
                    nlp_result.filler_detail.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )[:3]
                if top_fillers:
                    filler_info = (
                        " Top fillers: "
                        + ", ".join(f"{w}({c}x)" for w, c in top_fillers)
                        + "."
                    )

            summary = (
                f"Session {session_number}: Topic '{topic[:80]}'. "
                f"Scores filler={scores['filler']}, delivery={scores['delivery']}, "
                f"structure={scores['structure']}, vocab={scores['vocab']}, "
                f"confidence={scores['confidence']}.{filler_info} "
                f"Focus: {coaching_report.focus_area}. "
                f"Drill: {(coaching_report.daily_drill or '')[:100]}. "
                f"Fix: {(coaching_report.priority_fix or '')[:100]}."
            )

            advice_given = [
                a[:200]
                for a in [
                    coaching_report.priority_fix,
                    coaching_report.mechanical_tip,
                ]
                if a
            ]

            row = {
                "user_id": user_id,
                "session_id": session_id,
                "session_number": session_number,
                "summary_text": summary,
                "scores": scores,
                "top_issues": top_issues,
                "drill_given": (coaching_report.daily_drill or "")[:500] or None,
                "drill_completed": False,
                "advice_given": advice_given,
                "recurring_patterns": [],
                "topic_text": topic[:200],
                "speaking_goal": speaking_goal,
            }

            self.db.table("session_summaries").insert(row).execute()
            logger.info(f"[MemoryService] Summary saved for session {session_id[:8]}")
            return row

        except Exception as e:
            logger.error(f"[MemoryService] Failed to save summary: {e}")
            return {}

    # ------------------------------------------------------------------
    async def get_session_history(self, user_id: str, limit: int = 7) -> list:
        """Fetch the last *limit* session summaries (oldest-first)."""
        try:
            result = (
                self.db.table("session_summaries")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return list(reversed(result.data)) if result.data else []
        except Exception as e:
            logger.error(f"[MemoryService] History fetch failed: {e}")
            return []

    # ------------------------------------------------------------------
    async def detect_recurring_patterns(self, user_id: str) -> list:
        """Return issues that appear in ≥3 of the last 10 sessions."""
        try:
            history = await self.get_session_history(user_id, limit=10)
            if len(history) < 3:
                return []

            issue_counts: dict[str, int] = {}
            for session in history:
                issues = session.get("top_issues", [])
                if isinstance(issues, str):
                    issues = json.loads(issues)
                for issue in issues:
                    issue_counts[issue] = issue_counts.get(issue, 0) + 1

            return [iss for iss, cnt in issue_counts.items() if cnt >= 3]
        except Exception as e:
            logger.error(f"[MemoryService] Pattern detection failed: {e}")
            return []

    # ------------------------------------------------------------------
    async def check_drill_followup(self, user_id: str) -> dict:
        """Check whether the most recent drill was completed."""
        try:
            result = (
                self.db.table("session_summaries")
                .select("drill_given, drill_completed, session_number")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if not result.data:
                return {"has_previous_drill": False}

            last = result.data[0]
            return {
                "has_previous_drill": bool(last.get("drill_given")),
                "drill_text": last.get("drill_given", ""),
                "was_completed": last.get("drill_completed", False),
                "session_number": last.get("session_number", 0),
            }
        except Exception as e:
            logger.error(f"[MemoryService] Drill followup check failed: {e}")
            return {"has_previous_drill": False}

    # ------------------------------------------------------------------
    async def mark_drill_completed(
        self,
        user_id: str,
        session_id: str,
        drill_text: str,
        drill_type: str,
        self_rating: Optional[int] = None,
    ) -> bool:
        """Persist drill completion."""
        try:
            row: dict = {
                "user_id": user_id,
                "session_id": session_id,
                "drill_text": drill_text,
                "drill_type": drill_type,
            }
            if self_rating is not None:
                row["self_rating"] = self_rating

            self.db.table("drill_completions").insert(row).execute()

            # Mark the corresponding session_summary too
            self.db.table("session_summaries").update(
                {"drill_completed": True}
            ).eq("session_id", session_id).eq("user_id", user_id).execute()

            logger.info(f"[MemoryService] Drill completed for {user_id[:8]}")
            return True
        except Exception as e:
            logger.error(f"[MemoryService] mark_drill failed: {e}")
            return False
