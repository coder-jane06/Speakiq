import os
import resend
import logging
from config import get_db

logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = "Fluently <onboarding@resend.dev>" # Resend testing email

def send_notification_email(user_id: str, email_type: str, context: dict):
    """
    Sends a beautiful HTML email using Resend.
    email_type: 'reminder', 'weekly_report', 'streak_alert'
    context: variables to inject into the template
    """
    if not resend.api_key:
        logger.warning("No RESEND_API_KEY set. Skipping email.")
        return False

    db = get_db()
    try:
        # Get user email
        user_res = db.table("user_profiles").select("display_name").eq("user_id", user_id).execute()
        # Since auth emails are in auth.users, and we might not have access, we'll try to get it
        # Actually, Supabase doesn't let us query auth.users easily without service key.
        # We can just send to a hardcoded address for testing or fetch from auth.users if possible.
        # For this prototype, we'll send to a designated test email or skip if not found.
        # Wait, the user wants it to actually work. Let's use the service role key to fetch email.

        # We need the user's email from auth.users
        from supabase import create_client
        url = os.environ.get('SUPABASE_URL')
        key = os.environ.get('SUPABASE_SERVICE_KEY')
        admin_client = create_client(url, key)
        auth_user = admin_client.auth.admin.get_user_by_id(user_id)
        if not auth_user or not auth_user.user.email:
            logger.error("User email not found.")
            return False

        to_email = auth_user.user.email
        display_name = user_res.data[0].get("display_name", "Speaker") if user_res.data else "Speaker"

        # Check preferences
        profile = user_res.data[0] if user_res.data else {}
        prefs = profile.get("notification_preferences", {})
        if not prefs.get("email", False):
            logger.info(f"User {user_id} has disabled email notifications.")
            return False

        subject = ""
        html_body = ""

        if email_type == "reminder":
            if not prefs.get("dailyReminder"): return False
            subject = "Your Daily Practice Reminder"
            html_body = f"""
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f1115; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #1f2937;">
                <h2 style="color: #10b981; font-size: 24px; margin-bottom: 20px;">Hey {display_name}! 👋</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #d1d5db;">Consistency is the key to mastering your speaking skills. You haven't recorded a session today yet.</p>
                <div style="background-color: #111827; padding: 20px; border-radius: 12px; margin: 30px 0; border: 1px solid #374151;">
                    <p style="margin: 0; color: #9ca3af; font-size: 14px;">Today's Suggested Focus</p>
                    <p style="margin: 10px 0 0 0; color: #10b981; font-weight: bold; font-size: 18px;">Eliminate Filler Words</p>
                </div>
                <a href="https://fluently.app/dashboard" style="display: inline-block; background-color: #10b981; color: #000000; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 16px;">Record a 60s Session Now</a>
                <p style="margin-top: 40px; font-size: 12px; color: #6b7280;">You can manage your notification preferences in your Fluently Settings.</p>
            </div>
            """
        elif email_type == "streak":
            if not prefs.get("streakAlerts"): return False
            streak = context.get("streak", 0)
            subject = f"🔥 You're on a {streak}-day streak!"
            html_body = f"""
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f1115; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #f59e0b33;">
                <h2 style="color: #f59e0b; font-size: 24px; margin-bottom: 20px;">Unstoppable, {display_name}! 🚀</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #d1d5db;">You have successfully practiced for <strong>{streak} days in a row</strong>! Your AI coach has noticed massive improvements in your delivery.</p>
                <a href="https://fluently.app/dashboard" style="display: inline-block; background-color: #f59e0b; color: #000000; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 16px;">Keep the Streak Alive</a>
            </div>
            """

        if not html_body:
            return False

        params: resend.Emails.SendParams = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }

        email = resend.Emails.send(params)
        logger.info(f"Sent {email_type} email to {to_email}: {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False
