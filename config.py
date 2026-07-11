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
    # ── Authentication ─────────────────────────────────────────────────────────
    # REQUIRED: Get this from Supabase Dashboard → Settings → API → JWT Secret
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"

    # ── Supabase ────────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_key: str = ""

    # ── AI APIs ─────────────────────────────────────────────────────────────────
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""

    # ── Notifications ───────────────────────────────────────────────────────────
    resend_api_key: str = ""
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@speakiq.com"

    # ── App ─────────────────────────────────────────────────────────────────────
    environment: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Cached — reads .env once, reuses forever."""
    return Settings()


def get_db() -> Client:
    """Returns a Supabase client using the service role key.
    Created per request to avoid stale httpx connection pools.
    The service key bypasses RLS — use only for server-side operations."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        logger.warning("Supabase URL or Key is empty. Database queries will fail.")
    return create_client(s.supabase_url, s.supabase_service_key)


# Convenience singleton
settings = get_settings()