import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

try:
    users = supabase.auth.admin.list_users()
    print("Auth Users Count:", len(users))
except Exception as e:
    print("Error listing auth users:", e)

try:
    profiles = supabase.table("user_profiles").select("*", count="exact").execute()
    print("User Profiles Count:", profiles.count)
except Exception as e:
    print("Error listing user_profiles:", e)
