import asyncio
import os
import sys

# add parent dir to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

def update_profile():
    from config import get_db
    db = get_db()
    profiles = db.table("user_profiles").select("*").limit(1).execute()
    if profiles.data:
        profile_id = profiles.data[0]["id"]
        db.table("user_profiles").update({
            "total_sessions": 3,
            "filler_trend": "improving",
            "last_coached": "filler_words"
        }).eq("id", profile_id).execute()
        print("Updated profile:", profile_id)
    else:
        print("No user profiles found.")

if __name__ == "__main__":
    update_profile()
