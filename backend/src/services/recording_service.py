"""Recording CRUD operations."""

import logging
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models.job import Job
from src.models.recording import Recording
from src.schemas.recording import RecordingUpdate

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_user_recordings(
    db: AsyncSession,
    user_id: UUID,
    offset: int = 0,
    limit: int = 20,
) -> list[dict]:
    result = await db.execute(
        select(Recording)
        .where(Recording.user_id == user_id)
        .order_by(Recording.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    recordings = list(result.scalars().all())

    # Fetch latest job for each recording to determine active_job_id
    active_job_ids: dict[UUID, UUID | None] = {}
    if recordings:
        rec_ids = [r.id for r in recordings]
        jobs_result = await db.execute(
            select(Job)
            .where(Job.recording_id.in_(rec_ids))
            .order_by(Job.created_at.desc())
        )
        seen: set[UUID] = set()
        for job in jobs_result.scalars().all():
            if job.recording_id not in seen:
                seen.add(job.recording_id)
                active_job_ids[job.recording_id] = (
                    job.id if job.stage != "done" else None
                )

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "language": r.language,
            "duration_seconds": r.duration_seconds,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "active_job_id": (
                str(active_job_ids[r.id]) if r.id in active_job_ids and active_job_ids[r.id] is not None else None
            ),
        }
        for r in recordings
    ]


async def get_recording_with_job(
    db: AsyncSession,
    recording_id: UUID,
    user_id: UUID,
) -> dict | None:
    """Return recording detail with the latest active job, or None."""
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != user_id:
        return None

    result = await db.execute(
        select(Job)
        .where(Job.recording_id == recording_id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    latest_job = result.scalar_one_or_none()

    return {
        "id": str(recording.id),
        "name": recording.name,
        "language": recording.language,
        "duration_seconds": recording.duration_seconds,
        "created_at": recording.created_at.isoformat(),
        "active_job_id": (
            str(latest_job.id) if latest_job and latest_job.stage != "done" else None
        ),
    }


async def update_recording(
    db: AsyncSession,
    recording_id: UUID,
    user_id: UUID,
    data: RecordingUpdate,
) -> Recording | None:
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != user_id:
        return None

    if data.name is not None:
        recording.name = data.name

    await db.commit()
    await db.refresh(recording)
    return recording


async def delete_recording(
    db: AsyncSession,
    recording_id: UUID,
    user_id: UUID,
) -> bool:
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != user_id:
        return False

    # Capture file paths before deleting DB record
    rec_dir = Path(settings.AUDIO_STORAGE_PATH) / str(recording_id)

    await db.delete(recording)
    await db.commit()

    # Delete the recording directory and all its contents from disk
    if rec_dir.exists():
        import shutil
        shutil.rmtree(rec_dir)
        logger.info(f"Deleted recording directory: {rec_dir}")

    return True


async def auto_name_recording(
    db: AsyncSession,
    recording_id: UUID,
    user_id: UUID,
) -> str | None:
    """Generate a short descriptive name for a recording using the LLM."""
    from src.models.transcript import Transcript
    from src.services.llm_service import get_llm

    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != user_id:
        return None

    # Find the best available transcript (named > diarized > raw > output)
    for ttype in ("named", "diarized", "output", "raw"):
        result = await db.execute(
            select(Transcript).where(
                Transcript.recording_id == recording_id,
                Transcript.type == ttype,
            )
        )
        transcript = result.scalar_one_or_none()
        if transcript:
            break
    else:
        logger.warning(f"No transcripts found for recording {recording_id}")
        return None

    # Build a preview of the transcript (first ~2000 chars to keep it cheap)
    content = transcript.content
    try:
        import json
        segments = json.loads(content)
        if isinstance(segments, list):
            preview_lines = []
            for seg in segments:
                speaker = seg.get("speaker", "")
                text = seg.get("text", "")
                if speaker:
                    preview_lines.append(f"{speaker}: {text}")
                else:
                    preview_lines.append(text)
                if len("\n".join(preview_lines)) > 2000:
                    break
            preview = "\n".join(preview_lines)
        else:
            preview = content[:2000]
    except (json.JSONDecodeError, TypeError):
        preview = content[:2000]

    if not preview.strip():
        return None

    llm = get_llm()
    messages = [
        {
            "role": "system",
            "content": (
                "Generate a short, descriptive title for this meeting or conversation transcript. "
                "Reply with ONLY the title — no quotes, no explanation, no punctuation at the end. "
                "Keep it under 8 words. Example: Sprint Planning Q2 Roadmap Review"
            ),
        },
        {"role": "user", "content": f"Transcript:\n\n{preview}"},
    ]

    try:
        response = llm.invoke(messages)
        name = response.content if hasattr(response, "content") else str(response)
        name = name.strip().strip('"').strip("'").strip()
        # Remove common prefixes the LLM might add
        for prefix in ("Title:", "Name:", "Here is", "Here's"):
            if name.lower().startswith(prefix.lower()):
                name = name[len(prefix):].strip().lstrip(":").strip()
        if len(name) > 100:
            name = name[:100].rsplit(" ", 1)[0]
        recording.name = name
        await db.commit()
        await db.refresh(recording)
        logger.info(f"Auto-named recording {recording_id}: '{name}'")
        return name
    except Exception as e:
        logger.error(f"Auto-naming failed for recording {recording_id}: {e}")
        return None
