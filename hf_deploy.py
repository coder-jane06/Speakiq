from huggingface_hub import HfApi, login
from dotenv import dotenv_values

env_vars = dotenv_values("backend/.env")
token = env_vars.get("HUGGINGFACE_HUB_TOKEN")
if not token:
    raise RuntimeError("Set HUGGINGFACE_HUB_TOKEN in backend/.env before deploying.")

login(token=token)

api = HfApi()

# Get username
user_info = api.whoami()
username = user_info['name']
repo_id = f"{username}/speakiq-backend"

print(f"Deploying to: {repo_id}")

# Create space
try:
    api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Space created or already exists.")
except Exception as e:
    print(f"Error creating space: {e}")

secrets_to_add = [
    "SUPABASE_URL", "SUPABASE_SERVICE_KEY", 
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY",
    "RESEND_API_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"
]

# Add secrets
for key in secrets_to_add:
    if key in env_vars and env_vars[key]:
        api.add_space_secret(repo_id=repo_id, key=key, value=env_vars[key])
        print(f"Added secret: {key}")

# Upload backend files
print("Uploading backend files...")
try:
    api.upload_folder(
        folder_path="backend",
        repo_id=repo_id,
        repo_type="space",
        ignore_patterns=[
            "__pycache__/*", "**/*.pyc", ".env*", "venv/*", "venv/**", ".venv/*", ".venv/**", ".venv312/**", "backend_logs*.txt", "temp_phase4/*", "test_audio.webm", ".pytest_cache/*", ".coverage", "htmlcov/*", ".dev-*.log"
        ]
    )
    print("Files uploaded successfully!")
except Exception as e:
    print(f"Error uploading files: {e}")

print(f"Done! API URL will be: https://{username}-speakiq-backend.hf.space")
