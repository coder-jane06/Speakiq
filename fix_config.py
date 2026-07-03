import re

with open("config.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'frontend_env_path = BASE_DIR.parent / "frontend" / ".env"',
    'frontend_env_path = BASE_DIR / "frontend" / ".env"'
)

# And add the supabase_jwt_secret needed for auth
if "supabase_jwt_secret" not in content:
    content = content.replace(
        "class Settings(BaseSettings):",
        'class Settings(BaseSettings):\n    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"'
    )

with open("config.py", "w", encoding="utf-8") as f:
    f.write(content)
