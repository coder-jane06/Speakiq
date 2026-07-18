"""Deliver completed-session notifications according to saved preferences."""

import json
import logging
import os
from html import escape
from datetime import date
from typing import Any

from config import get_db

logger = logging.getLogger(__name__)


def _report_email_html(
    display_name: str,
    topic: str,
    scores: dict[str, int],
    overall_score: int,
    priority: str,
    report_url: str,
) -> str:
    """Return a self-contained, inbox-safe coaching email with a strong CTA."""
    name = escape(display_name or "Speaker")
    safe_topic = escape(topic or "your speaking practice")
    safe_priority = escape(priority)
    cards = "".join(
        f'''<td width="20%" style="padding:0 3px;vertical-align:top">
              <div style="background:#f4f7f2;border-radius:10px;padding:10px 3px;text-align:center">
                <div style="font:700 17px Arial,sans-serif;color:#18351c">{score}</div>
                <div style="margin-top:3px;font:600 9px Arial,sans-serif;color:#647168;text-transform:uppercase;letter-spacing:.4px">{escape(label)}</div>
              </div>
            </td>'''
        for label, score in scores.items()
    )
    cta = (
        f'<a href="{escape(report_url, quote=True)}" style="display:inline-block;background:#2f7d32;color:#ffffff;padding:15px 24px;border-radius:10px;font:700 15px Arial,sans-serif;text-decoration:none">Open my coaching report →</a>'
        if report_url else ""
    )
    return f'''<!doctype html>
<html><body style="margin:0;padding:0;background:#eef2ed;color:#18351c">
  <div style="display:none;max-height:0;overflow:hidden">Your Fluently report is ready — one focused step for your next practice.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ed;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(24,53,28,.12)">
      <tr><td style="padding:25px 32px;background:linear-gradient(135deg,#17351d,#2f7d32);color:#ffffff">
        <div style="font:700 22px Arial,sans-serif;letter-spacing:-.4px">Fluently</div>
        <div style="margin-top:21px;font:700 26px Arial,sans-serif;line-height:1.2">Your voice is getting stronger.</div>
        <div style="margin-top:8px;font:400 14px Arial,sans-serif;color:#d9f0d8">Your coaching report is ready to use.</div>
      </td></tr>
      <tr><td style="padding:30px 32px 12px">
        <p style="margin:0;font:400 16px Arial,sans-serif;line-height:1.55">Hi {name},</p>
        <p style="margin:10px 0 0;font:400 15px Arial,sans-serif;line-height:1.55;color:#516057">You showed up for <strong style="color:#18351c">{safe_topic}</strong>. Here is your snapshot — progress comes from noticing one thing and practising it deliberately.</p>
      </td></tr>
      <tr><td align="center" style="padding:12px 32px 22px">
        <div style="display:inline-block;width:112px;height:112px;border-radius:56px;background:#e1f3d9;border:8px solid #c5e7b8;text-align:center;line-height:1">
          <div style="padding-top:24px;font:700 39px Arial,sans-serif;color:#2f7d32">{overall_score}</div>
          <div style="margin-top:5px;font:700 10px Arial,sans-serif;color:#526b52;letter-spacing:1px">OVERALL SCORE</div>
        </div>
      </td></tr>
      <tr><td style="padding:0 26px 25px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>{cards}</tr></table></td></tr>
      <tr><td style="padding:0 32px 27px">
        <div style="border-left:4px solid #74b75e;background:#f2f8ef;border-radius:0 10px 10px 0;padding:15px 16px">
          <div style="font:700 11px Arial,sans-serif;color:#39783b;text-transform:uppercase;letter-spacing:.8px">Your next focus</div>
          <div style="margin-top:6px;font:400 15px Arial,sans-serif;line-height:1.5;color:#263b29">{safe_priority}</div>
        </div>
      </td></tr>
      <tr><td align="center" style="padding:0 32px 34px">{cta}<p style="margin:20px 0 0;font:400 12px Arial,sans-serif;line-height:1.5;color:#77827a">Small, consistent practice changes how you sound — and how you feel when you speak.</p></td></tr>
      <tr><td style="padding:18px 32px;background:#f5f7f4;text-align:center;font:400 11px Arial,sans-serif;line-height:1.5;color:#758077">You received this because session-completion emails are enabled in your Fluently settings.<br/>You can change notification preferences any time in the app.</td></tr>
    </table>
  </td></tr></table>
</body></html>'''


def _get_user_email(user_id: str) -> str | None:
    try:
        response = get_db().auth.admin.get_user_by_id(user_id)
        return getattr(getattr(response, "user", None), "email", None)
    except Exception as exc:
        logger.warning("[notifications] could not resolve user email: %s", exc)
        return None


def _reminder_email_html(display_name: str, streak: int, report_url: str) -> str:
    """A concise, encouraging daily reminder for users who explicitly opted in."""
    name = escape(display_name or "Speaker")
    streak_label = f"{max(0, streak)}-day streak" if streak else "next practice"
    cta = (
        f'<a href="{escape(report_url, quote=True)}" style="display:inline-block;background:#b8f45d;color:#13240d;padding:15px 24px;border-radius:10px;font:700 15px Arial,sans-serif;text-decoration:none">Practise for one minute →</a>'
        if report_url else ""
    )
    return f'''<!doctype html>
<html><body style="margin:0;padding:0;background:#eef2ed;color:#17351d">
  <div style="display:none;max-height:0;overflow:hidden">One thoughtful minute can keep your speaking habit moving.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ed;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(24,53,28,.12)">
      <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#17351d,#2f7d32);color:#ffffff">
        <div style="font:700 22px Arial,sans-serif">Fluently</div>
        <div style="margin-top:20px;font:700 27px Arial,sans-serif;line-height:1.18">Your voice deserves one focused minute today.</div>
      </td></tr>
      <tr><td style="padding:30px 32px;text-align:center">
        <div style="font:700 14px Arial,sans-serif;color:#43813e;letter-spacing:.8px;text-transform:uppercase">{escape(streak_label)}</div>
        <p style="margin:16px 0;font:400 16px Arial,sans-serif;line-height:1.6;color:#44564a">Hi {name}, confidence is not built in one perfect speech. It is built when you return, notice one small improvement, and speak again. Keep your momentum alive with a short Fluently practice.</p>
        {cta}
        <p style="margin:22px 0 0;font:400 12px Arial,sans-serif;line-height:1.55;color:#77827a">You received this because daily email reminders are enabled in your Fluently settings. You can change them any time.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>'''


def _claim_delivery(user_id: str, kind: str, delivery_day: date) -> bool:
    """Atomically reserve one delivery per user, type, and day; fail closed if unmigrated."""
    try:
        get_db().table("notification_deliveries").insert({
            "user_id": user_id,
            "kind": kind,
            "delivery_date": delivery_day.isoformat(),
        }).execute()
        return True
    except Exception as exc:
        logger.info("[notifications] reminder skipped (already sent or migration missing): %s", exc)
        return False


def send_daily_practice_reminders(today: date | None = None) -> dict[str, int]:
    """Send one opt-in daily reminder per user. Intended for a scheduled worker."""
    day = today or date.today()
    sent = skipped = 0
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("[notifications] RESEND_API_KEY is not configured; daily reminders skipped")
        return {"sent": 0, "skipped": 0}

    try:
        profiles = get_db().table("user_profiles").select(
            "user_id, display_name, notification_preferences"
        ).execute().data or []
    except Exception as exc:
        logger.exception("[notifications] could not load reminder recipients")
        raise RuntimeError("Unable to load reminder recipients") from exc

    frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
    practice_url = f"{frontend_url}/#/session" if frontend_url else ""
    import resend
    resend.api_key = api_key
    for profile in profiles:
        prefs = profile.get("notification_preferences") or {}
        if not (prefs.get("email") and prefs.get("dailyReminder")):
            skipped += 1
            continue
        user_id = profile.get("user_id")
        if not user_id or not _claim_delivery(user_id, "daily_practice", day):
            skipped += 1
            continue
        email = _get_user_email(user_id)
        if not email:
            skipped += 1
            continue
        try:
            streak_rows = get_db().table("streaks").select("current_streak").eq("user_id", user_id).limit(1).execute().data or []
            streak = int(streak_rows[0].get("current_streak") or 0) if streak_rows else 0
            resend.Emails.send({
                "from": os.getenv("RESEND_FROM_EMAIL", "Fluently <onboarding@resend.dev>"),
                "to": [email],
                "subject": "A small practice today can change tomorrow's voice",
                "html": _reminder_email_html(profile.get("display_name") or "Speaker", streak, practice_url),
            })
            sent += 1
        except Exception as exc:
            logger.warning("[notifications] daily reminder failed for %s: %s", user_id, exc)
    return {"sent": sent, "skipped": skipped}


def _send_push(user_id: str, payload: dict[str, Any]) -> None:
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    if not private_key:
        return
    try:
        from pywebpush import WebPushException, webpush
        db = get_db()
        subscriptions = db.table("push_subscriptions").select("*").eq("user_id", user_id).execute().data or []
        for subscription in subscriptions:
            try:
                webpush(
                    subscription_info={"endpoint": subscription["endpoint"], "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]}},
                    data=json.dumps(payload),
                    vapid_private_key=private_key,
                    vapid_claims={"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")},
                )
            except WebPushException as exc:
                if getattr(exc, "response", None) and exc.response.status_code == 410:
                    db.table("push_subscriptions").delete().eq("id", subscription["id"]).execute()
                else:
                    logger.warning("[notifications] push delivery failed: %s", exc)
    except Exception as exc:
        logger.warning("[notifications] push unavailable: %s", exc)


def send_session_complete_notifications(user_id: str, session_id: str, topic: str, coaching_report: Any) -> None:
    """Best-effort delivery; a notification failure cannot fail analysis."""
    try:
        db = get_db()
        rows = db.table("user_profiles").select("display_name, notification_preferences").eq("user_id", user_id).limit(1).execute().data
        profile = rows[0] if rows else {}
        prefs = profile.get("notification_preferences") or {}
        if not prefs.get("sessionCompletion", False):
            return
        scores = getattr(coaching_report, "scores", None)
        values = [getattr(scores, key, 0) for key in ("filler", "delivery", "structure", "vocab", "confidence")] if scores else []
        score_map = {
            "Fluency": int(getattr(scores, "filler", 0)),
            "Delivery": int(getattr(scores, "delivery", 0)),
            "Structure": int(getattr(scores, "structure", 0)),
            "Vocabulary": int(getattr(scores, "vocab", 0)),
            "Confidence": int(getattr(scores, "confidence", 0)),
        } if scores else {"Fluency": 0, "Delivery": 0, "Structure": 0, "Vocabulary": 0, "Confidence": 0}
        score = round(sum(score_map.values()) / len(score_map))
        priority = (getattr(coaching_report, "priority_fix", "") or "Open your report for your next practice step.")[:120]
        frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
        report_url = f"{frontend_url}/#/session/{session_id}/results" if frontend_url else ""
        message = f"{topic or 'Your session'} scored {score}/100. {priority}"
        if prefs.get("push", False):
            _send_push(user_id, {"title": "Fluently report ready", "body": message, "url": report_url})
        if prefs.get("email", False):
            api_key, email = os.getenv("RESEND_API_KEY"), _get_user_email(user_id)
            if api_key and email:
                import resend
                resend.api_key = api_key
                resend.Emails.send({
                    "from": os.getenv("RESEND_FROM_EMAIL", "Fluently <onboarding@resend.dev>"),
                    "to": [email],
                    "subject": f"Your Fluently report is ready — {score}/100",
                    "html": _report_email_html(profile.get("display_name") or "Speaker", topic, score_map, score, priority, report_url),
                })
    except Exception as exc:
        logger.warning("[notifications] completed-session delivery failed: %s", exc)
