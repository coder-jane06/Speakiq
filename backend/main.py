"""
Fluently FastAPI backend.

Run locally with:
    python -m uvicorn main:app --reload
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from routers import sessions
from routers.dashboard import router as dashboard_router

_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.2,
            send_default_pii=False,
            environment=os.getenv("ENVIRONMENT", "development"),
        )
    except ImportError:
        logging.getLogger(__name__).warning("SENTRY_DSN is configured but sentry-sdk is unavailable")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("fluently")
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


def validate_production_configuration() -> None:
    """Fail startup rather than serving a partially configured production API."""
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        return
    required = ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "FRONTEND_URL")
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise RuntimeError(f"Missing required production configuration: {', '.join(missing)}")


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
    logger.info("Fluently API starting up")

    import uvicorn
    import gc
    for obj in gc.get_objects():
        if isinstance(obj, uvicorn.Server):
            obj.config.timeout_keep_alive = 75

    validate_production_configuration()
    supabase_status = check_supabase()
    if supabase_status["status"] == "connected":
        logger.info("Supabase      : connected")
    else:
        logger.error("Supabase      : failed - %s", supabase_status["detail"])

    logger.info("Docs          : http://localhost:8002/docs")
    logger.info("----------------------------------------")

    yield

    logger.info("Fluently API shutting down")


app = FastAPI(
    title="Fluently API",
    description="AI-powered speech coaching backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development").lower() != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development").lower() != "production" else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

frontend_origins = ["http://localhost:3000", "http://localhost:4173", "http://localhost:5173", "http://127.0.0.1:5173"]
configured_frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
if configured_frontend:
    # FRONTEND_URL may include a GitHub Pages project path for report links.
    # CORS, however, must receive the browser origin only.
    parsed_frontend = urlsplit(configured_frontend)
    frontend_origins.append(
        f"{parsed_frontend.scheme}://{parsed_frontend.netloc}"
        if parsed_frontend.scheme and parsed_frontend.netloc
        else configured_frontend
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
    return {"status": "ok", "service": "fluently-api"}


@app.get("/system/status", tags=["system"])
async def system_status():
    supabase_status = check_supabase()
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        return {"api": {"status": "connected"}, "supabase": {"status": supabase_status["status"]}}
    return {
        "api": {"status": "connected"},
        "supabase": supabase_status,
    }


@app.get("/api", tags=["system"])
async def root():
    return {"message": "Fluently API — see /docs for endpoints"}


# ── Serve built frontend (React SPA) ─────────────────────────────────────────
# The frontend is built with `npm run build` inside frontend/
# Vite outputs to frontend/dist — we serve that here so everything
# runs on ONE server with no CORS issues.
# NOTE: This block is only relevant on HuggingFace or a self-hosted server that
#       builds the frontend into the container. When the frontend is deployed
#       separately (e.g. Render static site), this block is simply skipped.

_FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

# Known API path prefixes — the SPA catch-all must never intercept these.
_API_PREFIXES = (
    "sessions", "dashboard", "health", "system", "api", "docs", "redoc", "openapi.json",
)

if _FRONTEND_DIST.exists():
    # Mount static assets (JS / CSS / images) served under /assets/
    _assets_dir = _FRONTEND_DIST / "assets"
    if _assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_assets_dir)),
            name="assets",
        )

    @app.get("/{full_path:path}", tags=["frontend"])
    async def serve_spa(full_path: str):
        """
        Serve index.html for every SPA route so React Router / HashRouter
        can handle client-side navigation.

        FastAPI resolves named routes before the catch-all, so all /sessions,
        /dashboard, /health, etc. routes registered above are still reached
        correctly.  The guard below is a belt-and-suspenders safeguard for
        any path that somehow slips through.
        """
        if any(full_path == p or full_path.startswith(p + "/") for p in _API_PREFIXES):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        index = _FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse(
            status_code=404,
            content={"detail": "Frontend not built yet. Run: npm run build inside frontend/"},
        )

    logger.info("Frontend: serving from %s", _FRONTEND_DIST)
else:
    @app.get("/", tags=["system"])
    async def root_no_frontend():
        return {"message": "Fluently API — frontend not built. Run: cd frontend && npm run build"}
