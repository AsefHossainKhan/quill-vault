from uuid import UUID

from pydantic import BaseModel


class SpeakerResponse(BaseModel):
    id: UUID
    label: str
    name: str | None = None
    sample_start_seconds: float | None = None
    sample_end_seconds: float | None = None

    model_config = {"from_attributes": True}


class SpeakerUpdate(BaseModel):
    label: str
    name: str | None = None


class SpeakerBulkUpdate(BaseModel):
    speakers: list[SpeakerUpdate]
