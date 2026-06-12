"""Speaker management endpoints."""

import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.recording import Recording
from src.models.speaker import Speaker
from src.schemas.speaker import SpeakerBulkUpdate

router = APIRouter()


@router.get("/{recording_id}/speakers")
async def list_speakers(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.execute(
        Speaker.__table__.select().where(Speaker.recording_id == recording_id)
    )
    speakers = result.fetchall()
    return [
        {
            "id": str(s.id),
            "label": s.label,
            "name": s.name,
            "sample_start_seconds": s.sample_start_seconds,
            "sample_end_seconds": s.sample_end_seconds,
        }
        for s in speakers
    ]


@router.put("/{recording_id}/speakers")
async def update_speakers(
    recording_id: uuid.UUID,
    body: SpeakerBulkUpdate,
    db: DB,
    current_user: CurrentUser,
):
    """Bulk update speaker names → triggers re-naming pipeline."""
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    for update in body.speakers:
        result = await db.execute(
            Speaker.__table__.select().where(
                Speaker.recording_id == recording_id,
                Speaker.label == update.label,
            )
        )
        speaker = result.fetchone()
        if speaker:
            await db.execute(
                Speaker.__table__.update()
                .where(Speaker.id == speaker.id)
                .values(name=update.name)
            )

    await db.commit()
    return {"message": "Speakers updated"}
