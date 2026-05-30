import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)


class StreakService:

    def __init__(self, db):
        self.db = db

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
