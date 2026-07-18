"""Run by a trusted scheduler once per day (for example Render Cron)."""

import logging

from services.notification_service import send_daily_practice_reminders


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = send_daily_practice_reminders()
    logging.info("Daily reminder job complete: %s", result)
