"""Speaker management endpoints."""

import json
import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.recording import Recording
from src.models.speaker import Speaker
from src.models.transcript import Transcript
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

    # Build label → name mapping from the update payload
    label_to_name: dict[str, str] = {}
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
            if update.name:
                label_to_name[update.label] = update.name

    # Update the named transcript — replace speaker labels with assigned names
    if label_to_name:
        result = await db.execute(
            Transcript.__table__.select().where(
                Transcript.recording_id == recording_id,
                Transcript.type == "named",
            )
        )
        named_row = result.fetchone()
        if named_row:
            try:
                segments = json.loads(named_row.content)
                if isinstance(segments, list):
                    updated_segments = []
                    for seg in segments:
                        new_seg = dict(seg)
                        label = seg.get("speaker", "")
                        if label in label_to_name:
                            new_seg["speaker"] = label_to_name[label]
                        updated_segments.append(new_seg)
                    await db.execute(
                        Transcript.__table__.update()
                        .where(Transcript.id == named_row.id)
                        .values(content=json.dumps(updated_segments))
                    )
            except (json.JSONDecodeError, TypeError):
                pass  # If named transcript isn't JSON segments, skip

    await db.commit()
    return {"message": "Speakers updated"}
