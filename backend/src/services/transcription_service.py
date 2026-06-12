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
        audio: float32 numpy array. If stereo (2, N), uses mic channel (0).
        sample_rate: Sample rate (should be 16000).
        language: Language code (e.g. 'en', 'bn').

    Returns:
        List of {start, end, text} dicts.
    """
    model = _get_model()

    # Use mic channel only for transcription
    mono = audio[0] if audio.ndim == 2 else audio

    segments, _ = model.transcribe(
        mono,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    result = [
        {"start": s.start, "end": s.end, "text": s.text.strip()}
        for s in segments
    ]
    logger.info(f"Transcribed {len(result)} segments")
    return result
