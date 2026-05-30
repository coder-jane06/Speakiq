"""
SpeakIQ FastAPI backend.

Run locally with:
    python -m uvicorn main:app --reload
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import sessions
from routers.dashboard import router as dashboard_router

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("speakiq")


def check_supabase() -> dict[str, Any]:
    """Check that Supabase is reachable and the seeded topics table exists."""
    try:
        from config import get_db

        result = (
            get_db()
            .table("topics")
            .select("id", count="exact")
            .limit(1)
            .execute()
        )
        return {
            "status": "connected",
            "topics_count": result.count,
            "detail": None,
        }
    except Exception as exc:
        return {
            "status": "disconnected",
            "topics_count": None,
            "detail": str(exc),
        }


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("----------------------------------------")
    logger.info("SpeakIQ API starting up")

    import uvicorn
    import gc
    for obj in gc.get_objects():
        if isinstance(obj, uvicorn.Server):
            obj.config.timeout_keep_alive = 75

    supabase_status = check_supabase()
    if supabase_status["status"] == "connected":
        logger.info("Supabase      : connected")
    else:
        logger.error("Supabase      : failed - %s", supabase_status["detail"])

    logger.info("Docs          : http://localhost:8002/docs")
    logger.info("----------------------------------------")

    yield

    logger.info("SpeakIQ API shutting down")


app = FastAPI(
    title="SpeakIQ API",
    description="AI-powered speech coaching backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "[global] Unhandled exception on %s %s: %s: %s",
        request.method,
        request.url.path,
        type(exc).__name__,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "speakiq-api"}


@app.get("/system/status", tags=["system"])
async def system_status():
    supabase_status = check_supabase()
    return {
        "api": {"status": "connected"},
        "supabase": supabase_status,
    }


@app.get("/", tags=["system"])
async def root():
    return {"message": "SpeakIQ API - see /docs for endpoints"}
