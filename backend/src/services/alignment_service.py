"""WhisperX alignment service (placeholder — requires GPU for best results)."""

import logging

logger = logging.getLogger(__name__)


def align_transcript(
    audio_path: str,
    segments: list[dict],
    language: str,
) -> list[dict]:
    """
    Align transcription segments with audio using WhisperX.

    Currently a passthrough — segments are already time-aligned from
    faster-whisper transcription. Enable WhisperX alignment when GPU is
    available for more precise word-level timestamps.

    Args:
        audio_path: Path to audio file.
        segments: List of {start, end, text}.
        language: Language code.

    Returns:
        Aligned segments (same format).
    """
    # WhisperX alignment requires GPU and additional setup.
    # For now, return segments as-is since faster-whisper already provides
    # good time alignment via VAD.
    logger.info(f"Alignment: passing through {len(segments)} segments (no GPU alignment)")
    return segments
