import logging
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class StreakService:

    def __init__(self, db):
        self.db = db

    async def recalculate_streak_from_history(self, user_id: str):
        """Backfill streak by scanning ALL completed sessions for this user.
        Use this to fix users who have sessions but show 0 streak/sessions."""
        try:
            result = (
                self.db.table("sessions")
                .select("created_at")
                .eq("user_id", user_id)
                .eq("status", "complete")
                .order("created_at", desc=False)
                .execute()
            )
            sessions = result.data or []
            if not sessions:
                logger.info(f"[StreakService] No complete sessions for {user_id[:8]}")
                return

            # Get unique dates of completed sessions
            unique_dates = sorted(set(
                s["created_at"].split("T")[0]
                for s in sessions
                if s.get("created_at")
            ))

            if not unique_dates:
                return

            # Calculate current streak (consecutive days ending today or yesterday)
            today = date.today()
            date_objects = [date.fromisoformat(d) for d in unique_dates]

            # Walk backwards from today to find current streak
            current_streak = 0
            check_date = today
            date_set = set(date_objects)
            while check_date in date_set:
                current_streak += 1
                check_date -= timedelta(days=1)

            # If no session today, check yesterday (streak still alive)
            if current_streak == 0:
                check_date = today - timedelta(days=1)
                while check_date in date_set:
                    current_streak += 1
                    check_date -= timedelta(days=1)

            # Calculate longest streak
            longest_streak = 0
            run = 1
            for i in range(1, len(date_objects)):
                if (date_objects[i] - date_objects[i-1]).days == 1:
                    run += 1
                    longest_streak = max(longest_streak, run)
                else:
                    run = 1
            longest_streak = max(longest_streak, run, current_streak)

            last_date = unique_dates[-1]
            total = len(sessions)

            # Upsert into streaks table
            existing = self.db.table("streaks").select("id").eq("user_id", user_id).execute()
            payload = {
                "user_id": user_id,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_session_date": last_date,
                "total_sessions": total,
            }
            if existing.data:
                self.db.table("streaks").update(payload).eq("user_id", user_id).execute()
            else:
                self.db.table("streaks").insert(payload).execute()

            logger.info(
                f"[StreakService] Recalculated {user_id[:8]}: "
                f"current={current_streak}, longest={longest_streak}, total={total}"
            )
        except Exception as e:
            logger.error(f"[StreakService] recalculate failed for {user_id[:8]}: {e}")

    async def update_streak(self, user_id: str, session_id: str):
        """Called after a session completes. Updates streak data."""
        if not user_id:
            return

        today = date.today()

        try:
            # Record today's completion (ignore if already done today via upsert)
            self.db.table("daily_completions").upsert({
                "user_id": user_id,
                "completed_date": today.isoformat(),
                "session_id": session_id,
            }, on_conflict="user_id,completed_date").execute()

            # Get current streak record
            result = (
                self.db.table("streaks")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )

            if not result.data:
                # First session ever
                self.db.table("streaks").insert({
                    "user_id": user_id,
                    "current_streak": 1,
                    "longest_streak": 1,
                    "last_session_date": today.isoformat(),
                    "total_sessions": 1,
                }).execute()
                logger.info(f"[StreakService] New user {user_id[:8]}: streak=1")
                return

            streak = result.data[0]
            last_date_str = streak.get("last_session_date")
            current = streak.get("current_streak", 0)
            longest = streak.get("longest_streak", 0)
            total = streak.get("total_sessions", 0)

            # Calculate new streak
            if last_date_str:
                last = date.fromisoformat(last_date_str)
                diff = (today - last).days

                if diff == 0:
                    # Already did session today — still increment total
                    self.db.table("streaks").update({
                        "total_sessions": total + 1,
                        "updated_at": "now()",
                    }).eq("user_id", user_id).execute()
                    return
                elif diff == 1:
                    # Consecutive day — increment streak
                    current += 1
                else:
                    # Streak broken — reset to 1
                    current = 1
            else:
                current = 1

            longest = max(longest, current)
            total += 1

            self.db.table("streaks").update({
                "current_streak": current,
                "longest_streak": longest,
                "last_session_date": today.isoformat(),
                "total_sessions": total,
                "updated_at": "now()",
            }).eq("user_id", user_id).execute()

            logger.info(
                f"[StreakService] User {user_id[:8]}: "
                f"streak={current}, longest={longest}, total={total}"
            )

        except Exception as e:
            logger.error(f"[StreakService] Failed for user {user_id[:8]}: {e}")
