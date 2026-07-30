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

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    # The API must use a server-only service role key. Never fall back to a
    # browser-visible VITE_ key: that can mask a broken production deployment.
    supabase_url: str = ""
    supabase_service_key: str = ""
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    environment: str = os.getenv("ENVIRONMENT", "development")
    frontend_url: str = os.getenv("FRONTEND_URL", "")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Cached — reads .env once, reuses forever."""
    return Settings()


def get_db() -> Client:
    """Returns a Supabase client using the service role key. Created per request to avoid stale httpx connection pools."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        logger.warning("Supabase URL or Key is empty. Database queries will fail.")
    return create_client(s.supabase_url, s.supabase_service_key)


# Convenience singleton
settings = get_settings()
