import os
import json
import logging
from pywebpush import webpush, WebPushException
from config import get_db

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_CLAIMS = {
    "sub": os.environ.get("VAPID_SUBJECT", "mailto:admin@fluently.com")
}

def send_web_push(user_id: str, payload: dict):
    """
    Sends a Web Push notification to all subscriptions of a user.
    """
    if not VAPID_PRIVATE_KEY:
        logger.warning("No VAPID_PRIVATE_KEY set. Skipping push notification.")
        return False

    db = get_db()
    try:
        # Check notification preferences first
        profile_res = db.table("user_profiles").select("notification_preferences").eq("user_id", user_id).execute()
        if profile_res.data:
            prefs = profile_res.data[0].get("notification_preferences", {})
            if not prefs.get("push", False):
                logger.info(f"User {user_id} disabled push notifications.")
                return False

        # Get all subscriptions for this user
        subs_res = db.table("push_subscriptions").select("*").eq("user_id", user_id).execute()
        if not subs_res.data:
            return False

        success_count = 0
        for sub in subs_res.data:
            try:
                subscription_info = {
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth": sub["auth"]
                    }
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS
                )
                success_count += 1
            except WebPushException as ex:
                logger.error(f"Push failed: {ex}")
                # If gone, delete from DB
                if ex.response and ex.response.status_code == 410:
                    db.table("push_subscriptions").delete().eq("id", sub["id"]).execute()

        return success_count > 0
    except Exception as e:
        logger.error(f"Error sending push: {e}")
        return False
