"""
backend/config.py — Settings and Supabase client
All environment variables loaded here.
Import `settings` and `get_db` everywhere else.
"""

import logging
import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings
from supabase import Client, create_client
from dotenv import dotenv_values

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent

# Fallback: load from frontend/.env if backend/.env is missing
frontend_env = {}
try:
    frontend_env_path = BASE_DIR.parent / "frontend" / ".env"
    if frontend_env_path.exists():
        frontend_env = dotenv_values(frontend_env_path)
except Exception as e:
    logger.warning(f"Could not load frontend .env: {e}")


class Settings(BaseSettings):
    supabase_url: str = os.getenv("SUPABASE_URL") or frontend_env.get("VITE_SUPABASE_URL") or ""
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY") or frontend_env.get("VITE_SUPABASE_ANON_KEY") or ""
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    environment: str = os.getenv("ENVIRONMENT", "development")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Cached — reads .env once, reuses forever."""
    return Settings()


@lru_cache
def get_db() -> Client:
    """Returns a cached Supabase client using the service role key."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        logger.warning("Supabase URL or Key is empty. Database queries will fail.")
    return create_client(s.supabase_url, s.supabase_service_key)


# Convenience singleton
settings = get_settings()