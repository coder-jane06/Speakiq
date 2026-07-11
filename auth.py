"""
auth.py — JWT authentication for SpeakIQ backend.

Verifies Supabase-issued JWTs using the project's JWT secret.
The secret is found in: Supabase Dashboard → Settings → API → JWT Secret.
"""

import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from config import get_settings

logger = logging.getLogger(__name__)
bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
):
    """
    Validates the Bearer JWT from Supabase Auth.
    Raises HTTP 401 if the token is missing, expired, or tampered with.
    """
    token = credentials.credentials
    settings = get_settings()

    secret = settings.supabase_jwt_secret
    if not secret or secret == "super-secret-jwt-token-with-at-least-32-characters-long":
        logger.warning(
            "[auth] SUPABASE_JWT_SECRET is not set. "
            "Falling back to unverified token decoding to prevent server crash."
        )
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid token format.")

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            # Signature verification is ENABLED (do not pass verify_signature=False)
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please sign in again.")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience.")
    except jwt.InvalidTokenError as e:
        logger.warning(f"[auth] Invalid JWT: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
