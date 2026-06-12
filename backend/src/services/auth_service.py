"""Authentication service — register, login, token management."""

import logging
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User
from src.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)


async def register_user(
    db: AsyncSession,
    username: str,
    email: str,
    full_name: str,
    password: str,
) -> User:
    """Create a new user. Raises ValueError on duplicate username/email."""
    existing = await db.execute(
        select(User).where(or_(User.username == username, User.email == email))
    )
    if existing.scalar_one_or_none():
        raise ValueError("Username or email already registered")

    user = User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        is_active=True,  # Auto-activate for now; add email verification later
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"User registered: {user.username} ({user.email})")
    return user


async def authenticate_user(
    db: AsyncSession,
    identifier: str,
    password: str,
) -> tuple[str, str] | None:
    """
    Authenticate by username or email.
    Returns (access_token, refresh_token) on success, None on failure.
    """
    result = await db.execute(
        select(User).where(
            or_(User.username == identifier, User.email == identifier)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    token_data = {"sub": str(user.id), "username": user.username}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return access_token, refresh_token


async def refresh_tokens(
    db: AsyncSession,
    refresh_token: str,
) -> tuple[str, str] | None:
    """Rotate tokens. Returns (new_access, new_refresh) or None if invalid."""
    payload = decode_refresh_token(refresh_token)
    if not payload:
        return None

    user_id = payload.get("sub")
    user = await db.get(User, UUID(user_id))
    if not user or not user.is_active:
        return None

    token_data = {"sub": str(user.id), "username": user.username}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    return new_access, new_refresh
