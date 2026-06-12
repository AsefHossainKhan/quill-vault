"""
Test configuration — overrides the real DB with a test database,
provides async test client, and auth helpers.
"""

import asyncio
import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text

# Force test env before any app imports
os.environ.setdefault("JWT_SECRET", "test-secret-for-testing-only")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/quillvault_test",
)
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("AUDIO_STORAGE_PATH", "./data/test-audio")

from src.main import create_app  # noqa: E402
from src.api.deps import get_db  # noqa: E402
from src.models.base import Base  # noqa: E402

# Import ALL models so Base.metadata knows about them  # noqa: E402
from src.models.user import User  # noqa: F401
from src.models.recording import Recording  # noqa: F401
from src.models.job import Job  # noqa: F401
from src.models.transcript import Transcript  # noqa: F401
from src.models.speaker import Speaker  # noqa: F401
from src.models.template import Template  # noqa: F401
from src.models.chat_message import ChatMessage  # noqa: F401

TEST_DB_URL = os.environ["DATABASE_URL"]


# ─── Fixtures ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, seed built-in data, drop after."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Seed built-in templates using raw SQL for reliability
        for tmpl in [
            ("Meeting Minutes", "📋", "Meeting", "Generate structured meeting minutes.", True),
            ("Summary", "📝", "General", "Write a concise summary.", True),
            ("Action Items", "✅", "Meeting", "Extract action items.", True),
            ("Email Draft", "📧", "Communication", "Write a follow-up email.", True),
        ]:
            await conn.execute(
                text(
                    "INSERT INTO templates (id, name, icon, category, system_prompt, is_builtin, created_at, updated_at) "
                    "VALUES (gen_random_uuid(), :name, :icon, :category, :prompt, :builtin, NOW(), NOW())"
                ),
                {"name": tmpl[0], "icon": tmpl[1], "category": tmpl[2], "prompt": tmpl[3], "builtin": tmpl[4]},
            )
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db():
    """Provide a clean async DB session for direct model access in tests."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


async def _override_get_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client wired to the test database."""
    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> dict:
    """Register a user and return the response dict + password."""
    payload = {
        "username": "testuser",
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "testpass123",
    }
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 201
    return {**resp.json(), "password": payload["password"]}


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, registered_user: dict) -> dict:
    """Login and return Authorization headers."""
    resp = await client.post(
        "/auth/login",
        json={"identifier": registered_user["username"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_user(client: AsyncClient) -> dict:
    """Register a second user (for ownership/cross-user tests)."""
    payload = {
        "username": "otheruser",
        "email": "other@example.com",
        "full_name": "Other User",
        "password": "otherpass123",
    }
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 201
    return {**resp.json(), "password": payload["password"]}


@pytest_asyncio.fixture
async def second_auth_headers(client: AsyncClient, second_user: dict) -> dict:
    """Login as second user and return Authorization headers."""
    resp = await client.post(
        "/auth/login",
        json={"identifier": second_user["username"], "password": second_user["password"]},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def create_test_recording(client: AsyncClient, headers: dict, name: str = "Test Recording") -> dict:
    """Helper: create a recording with a dummy audio file."""
    dummy_audio = (b"\x00" * 1024)  # 1KB dummy webm
    resp = await client.post(
        "/recordings",
        headers=headers,
        data={"name": name, "language": "en"},
        files={"mic_audio": ("test.webm", dummy_audio, "audio/webm")},
    )
    assert resp.status_code == 202
    return resp.json()


async def create_test_template(client: AsyncClient, headers: dict, name: str = "Test Template") -> dict:
    """Helper: create a custom template."""
    resp = await client.post(
        "/templates",
        headers=headers,
        json={
            "name": name,
            "icon": "🧪",
            "category": "Test",
            "system_prompt": "Test prompt for {{transcript}}",
        },
    )
    assert resp.status_code == 201
    return resp.json()
