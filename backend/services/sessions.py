"""
Sessions router — placeholder for Phase 2.

Endpoints to be built:
  POST /sessions/upload   — upload audio, create session
  GET  /sessions          — list user's sessions
  GET  /sessions/{id}     — get single session + metrics
"""

import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_sessions():
    """Placeholder — returns empty list until Phase 2."""
    logger.info("[sessions] list_sessions called")
    return {"sessions": [], "message": "Sessions endpoint — Phase 2"}


@router.post("/upload")
async def upload_session():
    """Placeholder — full implementation in Phase 2."""
    logger.info("[sessions] upload_session called")
    return {"session_id": "placeholder", "status": "pending"}


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Placeholder — full implementation in Phase 2."""
    logger.info(f"[sessions] get_session called for {session_id}")
    return {"session_id": session_id, "status": "placeholder"}
