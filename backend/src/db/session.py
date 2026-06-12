from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Async engine for FastAPI
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Sync engine for Celery (Celery tasks are sync)
# ---------------------------------------------------------------------------
_sync_database_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg", "postgresql+psycopg2"
)

sync_engine = create_engine(
    _sync_database_url,
    pool_size=5,
)

SyncSessionLocal = sessionmaker(sync_engine, expire_on_commit=False)  # type: ignore[call-arg]
