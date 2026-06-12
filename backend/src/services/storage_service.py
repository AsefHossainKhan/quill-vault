"""File storage abstraction — save/load audio and transcript artifacts."""

import json
import logging
from pathlib import Path

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_recording_dir(recording_id: str) -> Path:
    """Get the storage directory for a recording."""
    return Path(settings.AUDIO_STORAGE_PATH) / recording_id


def get_transcripts_dir(recording_id: str) -> Path:
    """Get the transcripts directory for a recording."""
    return get_recording_dir(recording_id) / "transcripts"


def save_transcript(recording_id: str, transcript_type: str, content: str) -> Path:
    """
    Save a transcript artifact to disk.

    Args:
        recording_id: UUID string.
        transcript_type: 'raw' | 'diarized' | 'named' | 'output'
        content: JSON string (for raw/diarized/named) or markdown (for output).

    Returns:
        Path to saved file.
    """
    transcripts_dir = get_transcripts_dir(recording_id)
    transcripts_dir.mkdir(parents=True, exist_ok=True)

    ext = "md" if transcript_type == "output" else "json"
    filepath = transcripts_dir / f"{transcript_type}.{ext}"
    filepath.write_text(content, encoding="utf-8")

    logger.info(f"Saved transcript: {filepath}")
    return filepath


def load_transcript(recording_id: str, transcript_type: str) -> str | None:
    """Load a transcript artifact from disk. Returns None if not found."""
    transcripts_dir = get_transcripts_dir(recording_id)
    ext = "md" if transcript_type == "output" else "json"
    filepath = transcripts_dir / f"{transcript_type}.{ext}"

    if not filepath.exists():
        return None

    return filepath.read_text(encoding="utf-8")


def save_metadata(recording_id: str, metadata: dict) -> Path:
    """Save recording metadata to disk."""
    rec_dir = get_recording_dir(recording_id)
    rec_dir.mkdir(parents=True, exist_ok=True)

    filepath = rec_dir / "metadata.json"
    filepath.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    return filepath
