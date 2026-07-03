import os
import resend
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.environ.get("RESEND_API_KEY")

if not resend.api_key:
    print("NO API KEY")
else:
    try:
        r = resend.Emails.send({
            "from": "SpeakIQ <onboarding@resend.dev>",
            "to": "delivered@resend.dev",
            "subject": "Test from Speakiq",
            "html": "<strong>It works!</strong>"
        })
        print(r)
    except Exception as e:
        print(f"Error: {e}")
