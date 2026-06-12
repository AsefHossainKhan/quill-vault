"""Tests for /auth endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post("/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "full_name": "Alice Smith",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "alice"
    assert data["email"] == "alice@example.com"
    assert "id" in data
    # Password should NOT be in the response
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    payload = {
        "username": "bob",
        "email": "bob@example.com",
        "full_name": "Bob",
        "password": "pass123",
    }
    resp1 = await client.post("/auth/register", json=payload)
    assert resp1.status_code == 201

    # Same username, different email
    payload2 = {**payload, "email": "bob2@example.com"}
    resp2 = await client.post("/auth/register", json=payload2)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "username": "charlie",
        "email": "charlie@example.com",
        "full_name": "Charlie",
        "password": "pass123",
    }
    resp1 = await client.post("/auth/register", json=payload)
    assert resp1.status_code == 201

    # Different username, same email
    payload2 = {**payload, "username": "charlie2"}
    resp2 = await client.post("/auth/register", json=payload2)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # Register first
    await client.post("/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "mypass123",
    })

    # Login with username
    resp = await client.post("/auth/login", json={
        "identifier": "loginuser",
        "password": "mypass123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_with_email(client: AsyncClient):
    await client.post("/auth/register", json={
        "username": "emaillogin",
        "email": "emaillogin@example.com",
        "password": "pass123",
    })

    resp = await client.post("/auth/login", json={
        "identifier": "emaillogin@example.com",
        "password": "pass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json={
        "username": "wrongpw",
        "email": "wrongpw@example.com",
        "password": "correctpass",
    })

    resp = await client.post("/auth/login", json={
        "identifier": "wrongpw",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/auth/login", json={
        "identifier": "ghost",
        "password": "whatever",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_success(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/auth/verify", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_verify_no_token(client: AsyncClient):
    resp = await client.get("/auth/verify")
    assert resp.status_code in (401, 403)  # HTTPBearer returns 401/403 when no credentials


@pytest.mark.asyncio
async def test_verify_invalid_token(client: AsyncClient):
    resp = await client.get("/auth/verify", headers={
        "Authorization": "Bearer invalid.token.here",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, registered_user: dict):
    # Login to get refresh token
    login_resp = await client.post("/auth/login", json={
        "identifier": registered_user["username"],
        "password": registered_user["password"],
    })
    refresh_token = login_resp.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_token_invalid(client: AsyncClient):
    resp = await client.post("/auth/refresh", json={
        "refresh_token": "invalid.refresh.token",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password(client: AsyncClient):
    resp = await client.post("/auth/forgot-password", json={
        "email": "anyone@example.com",
    })
    assert resp.status_code == 200
    assert "message" in resp.json()


@pytest.mark.asyncio
async def test_reset_password(client: AsyncClient):
    resp = await client.post("/auth/reset-password", json={
        "email": "anyone@example.com",
        "otp": "123456",
        "new_password": "newsecurepass",
    })
    assert resp.status_code == 200
    assert "message" in resp.json()
