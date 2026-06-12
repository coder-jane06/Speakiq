import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

try:
    print("--- Searching user_profiles table ---")
    profiles = supabase.table("user_profiles").select("*").execute()
    for p in profiles.data:
        print(f"Profile User ID: {p.get('user_id')}, Total Sessions: {p.get('total_sessions')}")
        if p.get('total_sessions') == 29:
            print(">>> FOUND MATCH IN PROFILES! <<<")

    print("\n--- Searching sessions table ---")
    sessions = supabase.table("sessions").select("user_id").execute()
    
    session_counts = {}
    for s in sessions.data:
        uid = s.get("user_id")
        if uid:
            session_counts[uid] = session_counts.get(uid, 0) + 1
            
    for uid, count in session_counts.items():
        print(f"User ID: {uid}, Session Count: {count}")
        if count == 29:
            print(f">>> FOUND MATCH IN SESSIONS: {uid} <<<")
            
            # Fetch the user's email
            users_res = supabase.auth.admin.list_users()
            users = getattr(users_res, 'users', users_res)
            for u in users:
                u_id = getattr(u, 'id', u.get('id') if isinstance(u, dict) else None)
                if str(u_id) == str(uid):
                    email = getattr(u, 'email', u.get('email') if isinstance(u, dict) else "Unknown")
                    print(f"Email for this user is: {email}")

except Exception as e:
    import traceback
    traceback.print_exc()
