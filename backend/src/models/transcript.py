import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Transcript(Base, TimestampMixin):
    """
    type values: 'raw' | 'diarized' | 'named' | 'output'
    content is JSON string (list of segments) for raw/diarized/named
    content is markdown string for 'output'
    """

    __tablename__ = "transcripts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recordings.id"), index=True
    )
    type: Mapped[str] = mapped_column(String(16), index=True)
    content: Mapped[str] = mapped_column(Text)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("templates.id"), nullable=True
    )

    recording: Mapped["Recording"] = relationship(back_populates="transcripts")  # noqa: F821
