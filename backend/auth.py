"""Validated Supabase authentication helpers for API routes."""

import logging
from typing import Optional

from config import get_db

logger = logging.getLogger(__name__)


def get_user_id(authorization: Optional[str]) -> Optional[str]:
    """Return the verified user id for a Bearer token, if valid and unexpired."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        response = get_db().auth.get_user(token)
        user = getattr(response, "user", None)
        return str(user.id) if user and getattr(user, "id", None) else None
    except Exception as exc:
        logger.info("[auth] rejected invalid access token: %s", type(exc).__name__)
        return None
