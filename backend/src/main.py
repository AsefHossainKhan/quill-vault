"""QuillVault API — FastAPI application factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import (
    auth,
    chat,
    jobs,
    output,
    recordings,
    speakers,
    templates,
    transcripts,
)
from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info(f"Starting {settings.APP_NAME}")
    yield
    logger.info("Shutting down")
    from src.db.session import engine
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(recordings.router, prefix="/recordings", tags=["recordings"])
    app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
    app.include_router(transcripts.router, prefix="/recordings", tags=["transcripts"])
    app.include_router(speakers.router, prefix="/recordings", tags=["speakers"])
    app.include_router(templates.router, prefix="/templates", tags=["templates"])
    app.include_router(chat.router, prefix="/recordings", tags=["chat"])
    app.include_router(output.router, prefix="/recordings", tags=["output"])

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
