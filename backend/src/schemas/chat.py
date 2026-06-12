from uuid import UUID

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


class ChatResponse(BaseModel):
    response: str
