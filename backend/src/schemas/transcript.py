from uuid import UUID

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker: str | None = None


class TranscriptResponse(BaseModel):
    id: UUID
    recording_id: UUID
    type: str  # raw | diarized | named | output
    content: str
    template_id: UUID | None = None

    model_config = {"from_attributes": True}


class TranscriptContent(BaseModel):
    """Parsed transcript with structured segments (for raw/diarized/named types)."""

    segments: list[TranscriptSegment]
