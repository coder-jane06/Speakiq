import re

# 1. Update routers/sessions.py
with open("routers/sessions.py", "r", encoding="utf-8") as f:
    sessions_content = f.read()

# Make sure trigger_analysis takes authorization
sessions_content = sessions_content.replace(
    'difficulty_tier: str = "beginner",',
    'difficulty_tier: str = "beginner",\n    authorization: str = None,'
)

# Pass authorization to trigger_analysis in upload_session
sessions_content = sessions_content.replace(
    'difficulty_tier=normalized_difficulty,',
    'difficulty_tier=normalized_difficulty,\n        authorization=authorization,'
)

# Pass authorization to get_db in trigger_analysis
sessions_content = sessions_content.replace(
    'get_db().table("user_profiles")',
    'get_db(authorization).table("user_profiles")'
)
sessions_content = sessions_content.replace(
    'get_db().table("sessions").update',
    'get_db(authorization).table("sessions").update'
)

# Pass authorization to run_analysis_pipeline
sessions_content = sessions_content.replace(
    'difficulty_tier=difficulty_tier,',
    'difficulty_tier=difficulty_tier,\n            authorization=authorization,'
)

# Update get_db calls in routers/sessions.py
sessions_content = sessions_content.replace('db = get_db()', 'db = get_db(authorization)')
sessions_content = sessions_content.replace('get_db().table("sessions")', 'get_db(authorization).table("sessions")')

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(sessions_content)

# 2. Update analysis/pipeline.py
with open("analysis/pipeline.py", "r", encoding="utf-8") as f:
    pipeline_content = f.read()

pipeline_content = pipeline_content.replace(
    'difficulty_tier: str = "beginner",',
    'difficulty_tier: str = "beginner",\n    authorization: str = None,'
)
pipeline_content = pipeline_content.replace('db = get_db()', 'db = get_db(authorization)')
pipeline_content = pipeline_content.replace('get_db().table("sessions")', 'get_db(authorization).table("sessions")')

with open("analysis/pipeline.py", "w", encoding="utf-8") as f:
    f.write(pipeline_content)

# 3. Update routers/dashboard.py
with open("routers/dashboard.py", "r", encoding="utf-8") as f:
    dashboard_content = f.read()
dashboard_content = dashboard_content.replace('db = get_db()', 'db = get_db(authorization)')
with open("routers/dashboard.py", "w", encoding="utf-8") as f:
    f.write(dashboard_content)

# 4. Make sure get_db doesn't crash if authorization is None
with open("config.py", "r", encoding="utf-8") as f:
    config_content = f.read()
config_content = config_content.replace("if token:", "if token and isinstance(token, str):")
with open("config.py", "w", encoding="utf-8") as f:
    f.write(config_content)
    
print("Updated all files to use authorization token for get_db()")
