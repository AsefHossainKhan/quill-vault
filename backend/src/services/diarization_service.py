"""Speaker diarization using pyannote.audio + whisperx alignment."""

import logging
from functools import lru_cache

import numpy as np
import torch
from pyannote.audio import Pipeline

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=1)
def _get_diarization_pipeline() -> Pipeline:
    pipeline = Pipeline.from_pretrained(
        settings.DIARIZATION_MODEL,
        use_auth_token=settings.HUGGINGFACE_TOKEN,
    )
    device = torch.device("cuda" if settings.WHISPER_DEVICE == "cuda" else "cpu")
    pipeline.to(device)
    logger.info("Diarization pipeline loaded")
    return pipeline


def diarize_audio(
    audio: np.ndarray,
    sample_rate: int,
    transcription_segments: list[dict],
    language: str,
) -> list[dict]:
    """
    Run speaker diarization and assign speakers to transcription segments.

    Args:
        audio: float32 numpy array (mono or stereo).
        sample_rate: Sample rate.
        transcription_segments: List of {start, end, text} from transcription.
        language: Language code.

    Returns:
        List of {start, end, speaker, text} dicts.
    """
    pipeline = _get_diarization_pipeline()

    # Prepare mono input for diarization
    if audio.ndim == 2:
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    waveform = torch.from_numpy(mono).unsqueeze(0)
    diarization = pipeline({"waveform": waveform, "sample_rate": sample_rate})

    # Build segment → speaker mapping
    speaker_map: list[tuple[float, float, str]] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_map.append((turn.start, turn.end, speaker))

    # Assign speaker to each transcription segment
    result = []
    for seg in transcription_segments:
        mid = (seg["start"] + seg["end"]) / 2
        speaker = _find_speaker(mid, speaker_map)
        result.append(
            {
                "start": seg["start"],
                "end": seg["end"],
                "speaker": speaker,
                "text": seg["text"],
            }
        )

    logger.info(f"Diarized {len(result)} segments, found {len(speaker_map)} speaker turns")
    return result


def _find_speaker(time: float, speaker_map: list[tuple[float, float, str]]) -> str:
    for start, end, speaker in speaker_map:
        if start <= time <= end:
            return speaker
    return "Unknown"
