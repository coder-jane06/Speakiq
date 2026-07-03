import re

with open("config.py", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """
def get_db(token: str = None) -> Client:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        logger.warning("Supabase URL or Key is empty. Database queries will fail.")
    from supabase import ClientOptions
    options = ClientOptions()
    if token:
        token = token.replace("Bearer ", "")
        options.headers = {"Authorization": f"Bearer {token}"}
    return create_client(s.supabase_url, s.supabase_service_key, options=options)
"""

content = re.sub(r'def get_db\(\) -> Client:.*?return create_client\(s\.supabase_url, s\.supabase_service_key\)', replacement.strip(), content, flags=re.DOTALL)

with open("config.py", "w", encoding="utf-8") as f:
    f.write(content)
