"""Output generation endpoint — re-generate output with a given template."""

import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.recording import Recording
from src.models.speaker import Speaker
from src.models.template import Template
from src.models.transcript import Transcript
from src.services.output_service import generate_output

router = APIRouter()


@router.post("/{recording_id}/generate")
async def generate_output_endpoint(
    recording_id: uuid.UUID,
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Re-generate output with the specified template."""
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get the named transcript
    result = await db.execute(
        Transcript.__table__.select()
        .where(
            Transcript.recording_id == recording_id,
            Transcript.type == "named",
        )
        .order_by(Transcript.created_at.desc())
        .limit(1)
    )
    named_transcript = result.fetchone()

    if not named_transcript:
        raise HTTPException(
            status_code=400,
            detail="No named transcript available. Wait for processing to complete.",
        )

    import json

    named_segments = json.loads(named_transcript.content)

    # Generate output
    output_content = generate_output(named_segments, template.system_prompt)

    # Save new output transcript
    output_transcript = Transcript(
        recording_id=recording_id,
        type="output",
        content=output_content,
        template_id=template_id,
    )
    db.add(output_transcript)
    await db.commit()

    return {"content": output_content, "template_id": str(template_id)}
