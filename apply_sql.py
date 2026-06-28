import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
supabase = create_client(url, key)

sql = """
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS integrations_preferences JSONB NOT NULL DEFAULT '{
  "gcal": true,
  "gdrive": false,
  "notion": true,
  "slack": false,
  "zoom": true,
  "teams": false
}'::jsonb;
"""

try:
    res = supabase.rpc('execute_sql', {'sql_query': sql}).execute()
    print("Success:", res)
except Exception as e:
    print("Error executing SQL via RPC:", e)
