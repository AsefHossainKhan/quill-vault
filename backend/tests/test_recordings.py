"""Tests for /recordings endpoints."""

import pytest
from unittest.mock import patch
from httpx import AsyncClient

from tests.conftest import create_test_recording


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_create_recording(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)
    assert "recording_id" in result
    assert "job_id" in result
    mock_delay.assert_called_once()


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_create_recording_with_language(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    dummy_audio = (b"\x00" * 1024)
    resp = await client.post(
        "/recordings",
        headers=auth_headers,
        data={"name": "Bangla Test", "language": "bn"},
        files={"mic_audio": ("test.webm", dummy_audio, "audio/webm")},
    )
    assert resp.status_code == 202
    mock_delay.assert_called_once()


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_recordings(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    # Create a few recordings
    for i in range(3):
        await create_test_recording(client, auth_headers, f"Recording {i}")

    resp = await client.get("/recordings", headers=auth_headers)
    assert resp.status_code == 200
    recordings = resp.json()
    assert len(recordings) == 3


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_recordings_empty(mock_delay, client: AsyncClient, auth_headers: dict):
    resp = await client.get("/recordings", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_get_recording_detail(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers, "Detail Test")

    resp = await client.get(f"/recordings/{result['recording_id']}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Detail Test"
    assert data["id"] == result["recording_id"]
    assert "active_job_id" in data


@pytest.mark.asyncio
async def test_get_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/recordings/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_update_recording(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers, "Old Name")

    resp = await client.patch(
        f"/recordings/{result['recording_id']}",
        headers=auth_headers,
        json={"name": "New Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_delete_recording(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.delete(f"/recordings/{result['recording_id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/recordings/{result['recording_id']}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.delete(f"/recordings/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_cannot_access_other_users_recording(
    mock_delay, client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    """User B should not be able to access User A's recording."""
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers, "Private Recording")

    # User B tries to get it
    resp = await client.get(f"/recordings/{result['recording_id']}", headers=second_auth_headers)
    assert resp.status_code == 404

    # User B tries to delete it
    resp = await client.delete(f"/recordings/{result['recording_id']}", headers=second_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_recording_requires_auth(client: AsyncClient):
    dummy_audio = (b"\x00" * 1024)
    resp = await client.post(
        "/recordings",
        data={"name": "No Auth", "language": "en"},
        files={"mic_audio": ("test.webm", dummy_audio, "audio/webm")},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_recordings_pagination(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    for i in range(5):
        await create_test_recording(client, auth_headers, f"Paged {i}")

    # Page 1, 2 per page
    resp = await client.get("/recordings?page=1&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Page 2
    resp = await client.get("/recordings?page=2&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Page 3 (only 1 left)
    resp = await client.get("/recordings?page=3&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
