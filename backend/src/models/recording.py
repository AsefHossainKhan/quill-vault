import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Recording(Base, TimestampMixin):
    __tablename__ = "recordings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(10), default="en")
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    mic_audio_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    system_audio_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    user: Mapped["User"] = relationship(back_populates="recordings")  # noqa: F821
    jobs: Mapped[list["Job"]] = relationship(back_populates="recording", cascade="all, delete-orphan")  # noqa: F821
    transcripts: Mapped[list["Transcript"]] = relationship(back_populates="recording", cascade="all, delete-orphan")  # noqa: F821
    speakers: Mapped[list["Speaker"]] = relationship(back_populates="recording", cascade="all, delete-orphan")  # noqa: F821
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="recording", cascade="all, delete-orphan")  # noqa: F821
