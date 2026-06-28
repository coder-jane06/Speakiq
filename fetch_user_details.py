import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

try:
    users_response = supabase.auth.admin.list_users()
    users = getattr(users_response, 'users', users_response) # Handle different versions of supabase-py
    
    # fetch all profiles to correlate
    profiles_response = supabase.table("user_profiles").select("*").execute()
    profiles_by_user = {p['user_id']: p for p in profiles_response.data}
    
    results = []
    
    # Depending on supabase-py, users might be a list of User objects or a list of dicts.
    for u in users:
        uid = getattr(u, 'id', u.get('id') if isinstance(u, dict) else None)
        email = getattr(u, 'email', u.get('email') if isinstance(u, dict) else None)
        created_at = getattr(u, 'created_at', u.get('created_at') if isinstance(u, dict) else None)
        last_sign_in_at = getattr(u, 'last_sign_in_at', u.get('last_sign_in_at') if isinstance(u, dict) else None)
        
        has_profile = uid in profiles_by_user
        
        results.append({
            "id": str(uid),
            "email": str(email),
            "created_at": str(created_at),
            "last_sign_in_at": str(last_sign_in_at),
            "has_profile": has_profile
        })
        
    with open("user_details.json", "w") as f:
        json.dump(results, f)
        
    print("Exported details to user_details.json")
    
except Exception as e:
    import traceback
    traceback.print_exc()
