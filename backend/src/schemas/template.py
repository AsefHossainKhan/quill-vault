from uuid import UUID

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    icon: str = "📋"
    category: str = "General"
    system_prompt: str


class TemplateUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    category: str | None = None
    system_prompt: str | None = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    icon: str
    category: str
    system_prompt: str
    is_builtin: bool

    model_config = {"from_attributes": True}
