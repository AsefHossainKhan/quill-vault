from uuid import UUID

from pydantic import BaseModel


class JobStatus(BaseModel):
    job_id: UUID
    stage: str
    progress: int
    error: str | None = None
    recording_id: UUID
