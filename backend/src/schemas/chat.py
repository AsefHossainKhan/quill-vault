from uuid import UUID
from typing import Optional

from pydantic import BaseModel


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    message: str
    context_types: Optional[list[str]] = None  # e.g. ["raw", "named", "output"]


class ChatResponse(BaseModel):
    response: str
