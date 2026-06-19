"""Server-side transcription using faster-whisper."""

import logging
from functools import lru_cache

import numpy as np
from faster_whisper import WhisperModel

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=1)
def _get_model() -> WhisperModel:
    model = WhisperModel(
        settings.WHISPER_MODEL,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
    logger.info(f"Whisper model loaded: {settings.WHISPER_MODEL}")
    return model


def transcribe_audio(
    audio: np.ndarray,
    sample_rate: int,
    language: str,
) -> list[dict]:
    """
    Transcribe audio using faster-whisper.

    Args:
        audio: float32 numpy array. If stereo (2, N), averages both channels.
        sample_rate: Sample rate (should be 16000).
        language: Language code (e.g. 'en', 'bn').

    Returns:
        List of {start, end, text} dicts.
    """
    model = _get_model()

    # Mix channels: average mic + system for transcription
    # This ensures system audio (e.g. meeting speech) is included.
    if audio.ndim == 2:
        mono = np.mean(audio, axis=0).astype(np.float32)
    else:
        mono = audio

    segments, _ = model.transcribe(
        mono,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    result = []
    for i, seg in enumerate(segments, 1):
        result.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
        logger.info(f"  segment {i}: [{seg.start:.1f}s - {seg.end:.1f}s] {seg.text.strip()[:60]}")
    logger.info(f"Transcribed {len(result)} segments")
    return result
