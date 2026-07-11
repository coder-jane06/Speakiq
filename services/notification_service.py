import json
import logging
import os
from typing import Any

from config import get_db

logger = logging.getLogger(__name__)


def _prefs_enabled(prefs: dict[str, Any], *keys: str) -> bool:
    return all(bool(prefs.get(key, False)) for key in keys)


def _get_user_email(user_id: str) -> str | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client

        auth_user = create_client(url, key).auth.admin.get_user_by_id(user_id)
        return getattr(getattr(auth_user, "user", None), "email", None)
    except Exception as exc:
        logger.warning("[notifications] could not resolve user email: %s", exc)
        return None


def _send_email(to_email: str, subject: str, html: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.info("[notifications] RESEND_API_KEY not set; email skipped")
        return False
    try:
        import resend

        resend.api_key = api_key
        resend.Emails.send({
            "from": os.getenv("RESEND_FROM_EMAIL", "SpeakIQ <onboarding@resend.dev>"),
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as exc:
        logger.error("[notifications] email send failed: %s", exc)
        return False


def _send_push(user_id: str, payload: dict[str, Any]) -> bool:
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
    if not vapid_private_key:
        logger.info("[notifications] VAPID_PRIVATE_KEY not set; push skipped")
        return False

    db = get_db()
    try:
        from pywebpush import WebPushException, webpush

        subs = db.table("push_subscriptions").select("*").eq("user_id", user_id).execute().data or []
        sent = 0
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=json.dumps(payload),
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@speakiq.com")},
                )
                sent += 1
            except WebPushException as exc:
                if exc.response and exc.response.status_code == 410:
                    db.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
                else:
                    logger.warning("[notifications] push failed: %s", exc)
        return sent > 0
    except Exception as exc:
        logger.error("[notifications] push send failed: %s", exc)
        return False


def send_session_complete_notifications(
    user_id: str,
    session_id: str,
    topic: str,
    coaching_report: Any,
) -> None:
    db = get_db()
    try:
        result = (
            db.table("user_profiles")
            .select("display_name, notification_preferences")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        profile = result.data[0] if result.data else {}
        prefs = profile.get("notification_preferences") or {}
        if not _prefs_enabled(prefs, "sessionCompletion"):
            return

        display_name = profile.get("display_name") or "Speaker"
        scores = getattr(coaching_report, "scores", None)
        score_values = [
            getattr(scores, key, 0)
            for key in ("filler", "delivery", "structure", "vocab", "confidence")
        ] if scores else []
        avg_score = round(sum(score_values) / len(score_values)) if score_values else 0
        priority = getattr(coaching_report, "priority_fix", "") or "Open your report for the next practice step."
        report_url = f"{os.getenv('FRONTEND_URL', 'https://speakiq.app')}/session/{session_id}/results"

        if _prefs_enabled(prefs, "push"):
            _send_push(user_id, {
                "title": "SpeakIQ report ready",
                "body": f"{topic or 'Your session'} scored {avg_score}/100. {priority[:90]}",
                "url": report_url,
            })

        if _prefs_enabled(prefs, "email"):
            to_email = _get_user_email(user_id)
            if to_email:
                email_topic = topic or "today's speaking session"
                _send_email(
                    to_email,
                    "Your SpeakIQ coaching report is ready",
                    f"""
                    <div style="font-family: Inter, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0f1115; color: #f5f5f5; padding: 32px; border-radius: 16px;">
                      <h2 style="margin: 0 0 12px; color: #C8F97D;">Nice work, {display_name}</h2>
                      <p style="color: #d1d5db;">Your report for <strong>{email_topic}</strong> is ready.</p>
                      <p style="font-size: 24px; font-weight: 800; margin: 24px 0;">Overall score: {avg_score}/100</p>
                      <p style="color: #d1d5db;"><strong>Priority fix:</strong> {priority}</p>
                      <a href="{report_url}" style="display: inline-block; margin-top: 24px; background: #C8F97D; color: #09090F; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 800;">Open report</a>
                    </div>
                    """,
                )
    except Exception as exc:
        logger.error("[notifications] session completion notifications failed: %s", exc)
