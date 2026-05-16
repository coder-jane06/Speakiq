"""
app/config.py — Settings and Supabase client
All environment variables loaded here. Import `settings` and `get_db` everywhere else.
"""

import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings
from supabase import Client, create_client

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str
    anthropic_api_key: str
    environment: str = "development"

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Cached — reads .env once, reuses forever."""
    return Settings()


def get_db() -> Client:
    """
    Returns a Supabase client using the service role key.
    Use as a FastAPI dependency:
        db: Client = Depends(get_db)
    """
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


# Convenience singleton for use outside FastAPI dependency injection
settings = get_settings()
