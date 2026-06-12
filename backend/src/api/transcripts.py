"""Transcript retrieval endpoints."""

import json
import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.recording import Recording
from src.models.transcript import Transcript

router = APIRouter()


@router.get("/{recording_id}/transcripts")
async def list_transcripts(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.execute(
        Transcript.__table__.select().where(
            Transcript.recording_id == recording_id
        )
    )
    transcripts = result.fetchall()
    return [
        {
            "id": str(t.id),
            "type": t.type,
            "content": t.content,
            "template_id": str(t.template_id) if t.template_id else None,
        }
        for t in transcripts
    ]


@router.get("/{recording_id}/transcripts/{transcript_type}")
async def get_transcript(
    recording_id: uuid.UUID,
    transcript_type: str,
    db: DB,
    current_user: CurrentUser,
):
    if transcript_type not in ("raw", "diarized", "named", "output"):
        raise HTTPException(status_code=400, detail="Invalid transcript type")

    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.execute(
        Transcript.__table__.select().where(
            Transcript.recording_id == recording_id,
            Transcript.type == transcript_type,
        ).order_by(Transcript.created_at.desc()).limit(1)
    )
    transcript = result.fetchone()

    if not transcript:
        raise HTTPException(status_code=404, detail=f"No '{transcript_type}' transcript found")

    content = transcript.content
    # Parse JSON for segment-based types
    if transcript_type != "output":
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            pass

    return {
        "id": str(transcript.id),
        "type": transcript.type,
        "content": content,
    }
