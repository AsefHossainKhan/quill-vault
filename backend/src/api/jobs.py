"""Job status endpoint."""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUser, DB
from src.models.job import Job
from src.models.recording import Recording

router = APIRouter()


@router.get("/{job_id}/status")
async def get_job_status(
    job_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    result = await db.execute(
        select(Job)
        .options(selectinload(Job.recording))
        .where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify ownership via recording
    if job.recording.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "job_id": str(job.id),
        "stage": job.stage,
        "progress": job.progress,
        "error": job.error_message,
        "recording_id": str(job.recording_id),
    }
