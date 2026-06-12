"""Tests for /jobs, /transcripts, /speakers, and /chat endpoints."""

import pytest
from unittest.mock import patch
from httpx import AsyncClient

from tests.conftest import create_test_recording


# ─── Jobs ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_get_job_status(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)
    job_id = result["job_id"]

    resp = await client.get(f"/jobs/{job_id}/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == job_id
    assert data["stage"] == "queued"
    assert data["progress"] == 0
    assert data["error"] is None
    assert data["recording_id"] == result["recording_id"]


@pytest.mark.asyncio
async def test_get_job_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/jobs/{fake_id}/status", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_cannot_access_other_users_job(
    mock_delay, client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)
    job_id = result["job_id"]

    resp = await client.get(f"/jobs/{job_id}/status", headers=second_auth_headers)
    assert resp.status_code == 403


# ─── Transcripts ────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_transcripts_empty(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.get(
        f"/recordings/{result['recording_id']}/transcripts",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_transcripts_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/recordings/{fake_id}/transcripts", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_get_specific_transcript_type_not_found(
    mock_delay, client: AsyncClient, auth_headers: dict
):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.get(
        f"/recordings/{result['recording_id']}/transcripts/raw",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_get_transcript_invalid_type(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.get(
        f"/recordings/{result['recording_id']}/transcripts/invalid_type",
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ─── Speakers ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_speakers_empty(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.get(
        f"/recordings/{result['recording_id']}/speakers",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_speakers_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/recordings/{fake_id}/speakers", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_update_speakers(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.put(
        f"/recordings/{result['recording_id']}/speakers",
        headers=auth_headers,
        json={
            "speakers": [
                {"label": "SPEAKER_00", "name": "Alice"},
                {"label": "SPEAKER_01", "name": "Bob"},
            ]
        },
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Speakers updated"


# ─── Chat ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_list_chat_empty(mock_delay, client: AsyncClient, auth_headers: dict):
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    resp = await client.get(
        f"/recordings/{result['recording_id']}/chat",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_chat_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/recordings/{fake_id}/chat", headers=auth_headers)
    assert resp.status_code == 404


# ─── Output Generation ──────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("src.api.recordings.process_recording.delay")
async def test_generate_no_transcript(mock_delay, client: AsyncClient, auth_headers: dict):
    """Generate endpoint should 400 if no named transcript exists yet."""
    mock_delay.return_value = None
    result = await create_test_recording(client, auth_headers)

    # Get a built-in template ID
    templates_resp = await client.get("/templates", headers=auth_headers)
    template_id = templates_resp.json()[0]["id"]

    resp = await client.post(
        f"/recordings/{result['recording_id']}/generate",
        headers=auth_headers,
        params={"template_id": template_id},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_generate_recording_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = "00000000-0000-0000-0000-000000000000"
    templates_resp = await client.get("/templates", headers=auth_headers)
    template_id = templates_resp.json()[0]["id"]

    resp = await client.post(
        f"/recordings/{fake_id}/generate",
        headers=auth_headers,
        params={"template_id": template_id},
    )
    assert resp.status_code == 404


# ─── Auth Protection ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_recordings_require_auth(client: AsyncClient):
    resp = await client.get("/recordings")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_templates_require_auth(client: AsyncClient):
    resp = await client.get("/templates")
    assert resp.status_code in (401, 403)
