from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class RecordingCreate(BaseModel):
    name: str
    language: str = "en"
    template_id: UUID | None = None


class RecordingResponse(BaseModel):
    id: UUID
    name: str
    language: str
    duration_seconds: float | None = None
    created_at: datetime
    active_job_id: UUID | None = None

    model_config = {"from_attributes": True}


class RecordingListResponse(BaseModel):
    id: UUID
    name: str
    language: str
    duration_seconds: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecordingUpdate(BaseModel):
    name: str | None = None
