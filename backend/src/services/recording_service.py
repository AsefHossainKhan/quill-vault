"""Recording CRUD operations."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.job import Job
from src.models.recording import Recording
from src.schemas.recording import RecordingUpdate

logger = logging.getLogger(__name__)


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

    await db.delete(recording)
    await db.commit()
    return True
