import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

USER_ID = "4c940490-afc9-4cfa-bdef-ef9e5eca6b49"
NEW_PASSWORD = "Shaurya"

try:
    res = supabase.auth.admin.update_user_by_id(USER_ID, {"password": NEW_PASSWORD})
    print(f"Password reset successful for: {res.user.email}")
except Exception as e:
    import traceback
    traceback.print_exc()
