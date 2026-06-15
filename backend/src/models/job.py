import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Job(Base, TimestampMixin):
    """
    Pipeline job tracking.

    Possible stages (in order):
        Server mode:  queued → transcribing → diarizing → naming → generating → done
        Client mode:  queued → diarizing → naming → generating → done
        Any stage can transition to: failed
    """

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recordings.id"), index=True
    )
    stage: Mapped[str] = mapped_column(String(32), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0–100
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("templates.id"), nullable=True
    )
    # 'server' = full pipeline on backend, 'client' = transcript uploaded from frontend
    transcription_mode: Mapped[str] = mapped_column(String(16), default="server")

    recording: Mapped["Recording"] = relationship(back_populates="jobs")  # noqa: F821
    template: Mapped["Template | None"] = relationship()  # noqa: F821
