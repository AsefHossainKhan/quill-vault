import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Speaker(Base, TimestampMixin):
    __tablename__ = "speakers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recordings.id"), index=True
    )
    label: Mapped[str] = mapped_column(String(32))  # e.g. "SPEAKER_00"
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # e.g. "Alice"
    sample_start_seconds: Mapped[float | None] = mapped_column(nullable=True)
    sample_end_seconds: Mapped[float | None] = mapped_column(nullable=True)

    recording: Mapped["Recording"] = relationship(back_populates="speakers")  # noqa: F821
