import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recordings.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # 'user' | 'assistant' | 'system'
    content: Mapped[str] = mapped_column(Text)

    recording: Mapped["Recording"] = relationship(back_populates="chat_messages")  # noqa: F821
