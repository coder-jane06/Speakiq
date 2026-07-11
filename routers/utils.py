"""
routers/utils.py — Shared utilities for API routers.

Centralises token decoding so each router doesn't need its own copy.
"""

import logging
from typing import Optional

import jwt

logger = logging.getLogger(__name__)


def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """
    Extract the user's UUID from a Bearer JWT token WITHOUT verifying the
    signature. This is only safe for non-sensitive reads where the token
    is used purely for personalisation (e.g. topic selection).

    For any write operation or access-controlled read, use the
    `get_current_user` dependency from auth.py instead — it verifies
    the signature against the Supabase JWT secret.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.replace("Bearer ", "")
        # NOTE: signature NOT verified here — only used for personalisation hints.
        # For protected endpoints use auth.get_current_user which DOES verify.
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")
    except Exception as exc:
        logger.debug(f"[utils] Could not extract user_id from token: {exc}")
        return None
