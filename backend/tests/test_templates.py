"""Tests for /templates endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import create_test_template


@pytest.mark.asyncio
async def test_list_templates_returns_builtins(client: AsyncClient, auth_headers: dict):
    """Built-in templates (seeded) should appear in the list."""
    resp = await client.get("/templates", headers=auth_headers)
    assert resp.status_code == 200
    templates = resp.json()
    assert isinstance(templates, list)
    # We seeded 4 built-in templates
    assert len(templates) >= 4
    builtin_names = {t["name"] for t in templates if t["is_builtin"]}
    assert "Meeting Minutes" in builtin_names
    assert "Summary" in builtin_names
    assert "Action Items" in builtin_names
    assert "Email Draft" in builtin_names


@pytest.mark.asyncio
async def test_create_custom_template(client: AsyncClient, auth_headers: dict):
    tmpl = await create_test_template(client, auth_headers, "My Custom Template")
    assert tmpl["name"] == "My Custom Template"
    assert tmpl["icon"] == "🧪"
    assert tmpl["category"] == "Test"
    assert tmpl["is_builtin"] is False


@pytest.mark.asyncio
async def test_update_custom_template(client: AsyncClient, auth_headers: dict):
    tmpl = await create_test_template(client, auth_headers, "Original Name")
    resp = await client.put(
        f"/templates/{tmpl['id']}",
        headers=auth_headers,
        json={"name": "Updated Name", "icon": "🔄"},
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "Updated Name"
    assert updated["icon"] == "🔄"


@pytest.mark.asyncio
async def test_delete_custom_template(client: AsyncClient, auth_headers: dict):
    tmpl = await create_test_template(client, auth_headers, "To Delete")
    resp = await client.delete(f"/templates/{tmpl['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get("/templates", headers=auth_headers)
    ids = [t["id"] for t in list_resp.json()]
    assert tmpl["id"] not in ids


@pytest.mark.asyncio
async def test_cannot_modify_builtin_template(client: AsyncClient, auth_headers: dict):
    # Get a built-in template
    list_resp = await client.get("/templates", headers=auth_headers)
    builtin = next(t for t in list_resp.json() if t["is_builtin"])

    resp = await client.put(
        f"/templates/{builtin['id']}",
        headers=auth_headers,
        json={"name": "Hacked"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_delete_builtin_template(client: AsyncClient, auth_headers: dict):
    list_resp = await client.get("/templates", headers=auth_headers)
    builtin = next(t for t in list_resp.json() if t["is_builtin"])

    resp = await client.delete(f"/templates/{builtin['id']}", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_nonexistent_template(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.put(
        f"/templates/{fake_id}",
        headers=auth_headers,
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_template(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.delete(f"/templates/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_sees_own_templates(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    """User A's custom templates should NOT appear in User B's list."""
    await create_test_template(client, auth_headers, "Alice's Template")

    resp_b = await client.get("/templates", headers=second_auth_headers)
    names = [t["name"] for t in resp_b.json()]
    assert "Alice's Template" not in names

    # But built-in templates should still show
    assert "Meeting Minutes" in names
