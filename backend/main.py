"""
SpeakIQ — FastAPI Backend
Entry point: uvicorn main:app --reload
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import sessions

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# ─── Logging setup ───────────────────────────────────────────
# Configure once here — all other modules use logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("speakiq")


# ─── Lifespan (startup / shutdown) ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  SpeakIQ API starting up")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # Verify Supabase connection
    try:
        from config import get_db
        db = get_db()
        db.table("topics").select("id").limit(1).execute()
        logger.info("Supabase      : ✓ connected")
    except Exception as e:
        logger.error(f"Supabase      : ✗ failed — {e}")

    logger.info("Docs          : http://localhost:8000/docs")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    yield
    logger.info("SpeakIQ API shutting down — goodbye")


# ─── App instance ────────────────────────────────────────────
app = FastAPI(
    title="SpeakIQ API",
    description="AI-powered speech coaching backend",
    version="0.1.0",
    lifespan=lifespan,
    # Disable default /docs in production later
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── CORS ────────────────────────────────────────────────────
# In production, replace origins with your real domain
ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:4173",   # Vite preview server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler ────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"[global] Unhandled exception on {request.method} {request.url.path}: "
        f"{type(exc).__name__}: {exc}"
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ─── Routers ─────────────────────────────────────────────────
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])


# ─── Health check ────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    """
    Returns 200 OK when the server is running.
    The React SystemStatus component polls this endpoint.
    """
    return {"status": "ok", "service": "speakiq-api"}


# ─── Root ────────────────────────────────────────────────────
@app.get("/", tags=["system"])
async def root():
    return {"message": "SpeakIQ API — see /docs for endpoints"}
