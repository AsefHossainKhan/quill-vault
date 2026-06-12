"""Recording endpoints — upload, list, detail, update, delete."""

import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from src.api.deps import CurrentUser, DB
from src.config import get_settings
from src.models.job import Job
from src.models.recording import Recording
from src.models.template import Template
from src.schemas.recording import RecordingUpdate
from src.services import recording_service
from src.tasks.pipeline import process_recording

router = APIRouter()
settings = get_settings()
MAX_BYTES = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_recording(
    db: DB,
    current_user: CurrentUser,
    name: str = Form(...),
    language: str = Form("en"),
    template_id: str | None = Form(None),
    mic_audio: UploadFile = File(...),
    system_audio: UploadFile | None = File(None),
):
    """Upload audio files and start processing pipeline."""
    recording_id = uuid.uuid4()
    storage_dir = Path(settings.AUDIO_STORAGE_PATH) / str(recording_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    mic_path = str(storage_dir / "mic_audio.webm")
    system_path = None

    # Save mic audio (read entire content — UploadFile in newer Starlette)
    mic_content = await mic_audio.read()
    if len(mic_content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    async with aiofiles.open(mic_path, "wb") as f:
        await f.write(mic_content)

    if system_audio and system_audio.filename:
        system_path = str(storage_dir / "system_audio.webm")
        sys_content = await system_audio.read()
        async with aiofiles.open(system_path, "wb") as f:
            await f.write(sys_content)

    # Validate template
    tmpl = None
    if template_id:
        tmpl = await db.get(Template, uuid.UUID(template_id))
        if not tmpl:
            raise HTTPException(status_code=404, detail="Template not found")

    # Create DB records
    recording = Recording(
        id=recording_id,
        user_id=current_user.id,
        name=name,
        language=language,
        mic_audio_path=mic_path,
        system_audio_path=system_path,
    )
    db.add(recording)
    await db.flush()  # Flush recording so its ID is available for the job

    job = Job(
        recording_id=recording_id,
        template_id=tmpl.id if tmpl else None,
        stage="queued",
        progress=0,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue Celery task
    process_recording.delay(str(job.id))

    return {"recording_id": str(recording_id), "job_id": str(job.id)}


@router.get("")
async def list_recordings(
    db: DB,
    current_user: CurrentUser,
    page: int = 1,
    per_page: int = 20,
):
    offset = (page - 1) * per_page
    recordings = await recording_service.get_user_recordings(
        db, current_user.id, offset=offset, limit=per_page
    )
    return recordings


@router.get("/{recording_id}")
async def get_recording(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    result = await recording_service.get_recording_with_job(
        db, recording_id, current_user.id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Not found")
    return result


@router.patch("/{recording_id}")
async def update_recording(
    recording_id: uuid.UUID,
    body: RecordingUpdate,
    db: DB,
    current_user: CurrentUser,
):
    recording = await recording_service.update_recording(
        db, recording_id, current_user.id, body
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Not found")
    return {"id": str(recording.id), "name": recording.name}


@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    deleted = await recording_service.delete_recording(db, recording_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Not found")
