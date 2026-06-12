"""Audio preprocessing and channel merging."""

import logging
from pathlib import Path

import librosa
import noisereduce as nr
import numpy as np

logger = logging.getLogger(__name__)

TARGET_SR = 16_000


def preprocess_and_merge(
    mic_path: str | None,
    system_path: str | None,
) -> tuple[np.ndarray, int]:
    """
    Load, clean, and merge mic + system audio channels.

    Returns:
        (audio_array, sample_rate)
        audio_array shape: (samples,) mono or (2, samples) stereo.
    """
    mic = _load_and_clean(mic_path) if mic_path and Path(mic_path).exists() else None
    sys_audio = (
        _load_and_clean(system_path)
        if system_path and Path(system_path).exists()
        else None
    )

    if mic is not None and sys_audio is not None:
        length = min(len(mic), len(sys_audio))
        logger.info(f"Merging stereo: mic={len(mic)}s, system={len(sys_audio)}s, using {length}s")
        return np.stack([mic[:length], sys_audio[:length]], axis=0), TARGET_SR

    if mic is not None:
        logger.info(f"Using mic-only: {len(mic)} samples")
        return mic, TARGET_SR

    if sys_audio is not None:
        logger.info(f"Using system-only: {len(sys_audio)} samples")
        return sys_audio, TARGET_SR

    raise ValueError("No valid audio files provided")


def _load_and_clean(path: str) -> np.ndarray:
    """Load audio, apply noise reduction, normalize."""
    y, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    y = nr.reduce_noise(y=y, sr=TARGET_SR, prop_decrease=0.6, stationary=True)
    y = y / (np.max(np.abs(y)) + 1e-8)
    return y.astype(np.float32)
