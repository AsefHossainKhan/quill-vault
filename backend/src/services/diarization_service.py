"""Speaker diarization using pyannote.audio + whisperx alignment."""

import logging
import warnings
from functools import lru_cache

import numpy as np
import torch

# Suppress the pyannote torchcodec warning — we use librosa for audio loading,
# so pyannote's built-in torchcodec decoder is never used.
warnings.filterwarnings("ignore", message=".*torchcodec.*")
warnings.filterwarnings("ignore", message=".*degrees of freedom.*")
warnings.filterwarnings("ignore", message=".*std\\(\\).*")

from pyannote.audio import Pipeline  # noqa: E402

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=1)
def _get_diarization_pipeline() -> Pipeline:
    # pyannote.audio 3.1+ uses 'token'; older versions use 'use_auth_token'
    try:
        pipeline = Pipeline.from_pretrained(
            settings.DIARIZATION_MODEL,
            token=settings.HUGGINGFACE_TOKEN,
        )
    except TypeError:
        pipeline = Pipeline.from_pretrained(
            settings.DIARIZATION_MODEL,
            use_auth_token=settings.HUGGINGFACE_TOKEN,
        )
    # Diarization uses PyTorch RNNs which need cuDNN. When ctranslate2
    # (faster-whisper) pulls in CUDA 12 cublas, it can conflict with
    # PyTorch's CUDA 11.8 cuDNN. Run diarization on CPU to avoid this.
    # It's fast enough (a few seconds per recording) and avoids all
    # CUDA version mismatch issues.
    pipeline.to(torch.device("cpu"))
    logger.info("Diarization pipeline loaded (CPU)")
    return pipeline


def diarize_audio(
    audio: np.ndarray,
    sample_rate: int,
    transcription_segments: list[dict],
    language: str,
) -> list[dict]:
    """
    Run speaker diarization on the whole audio and produce diarization-driven
    segments with transcription text merged in.

    The diarization output is the PRIMARY segmentation — pyannote's speaker
    turns define the segment boundaries and speaker assignments. Transcription
    text from Whisper is then mapped onto these diarized segments by time
    overlap. This means:
      - The output can have MORE or FEWER segments than the input transcription
      - Speaker assignment is based on pyannote's voice activity detection,
        not Whisper chunk boundaries (eliminates single-speaker-per-chunk bias)
      - Segments where pyannote detects no overlapping speech are skipped

    Args:
        audio: float32 numpy array (mono or stereo).
        sample_rate: Sample rate.
        transcription_segments: List of {start, end, text} from transcription.
        language: Language code.

    Returns:
        List of {start, end, speaker, text} dicts driven by diarization.
    """
    pipeline = _get_diarization_pipeline()

    # Prepare mono input for diarization
    if audio.ndim == 2:
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    waveform = torch.from_numpy(mono).unsqueeze(0)
    diarization = pipeline({"waveform": waveform, "sample_rate": sample_rate})

    # pyannote 4.x returns a DiarizeOutput dataclass; extract the Annotation.
    annotation = getattr(diarization, "speaker_diarization", diarization)

    # Collect pyannote's speaker turns (the authoritative segmentation)
    # Filter out very short turns (< 0.3s) — these are typically noise,
    # brief pauses, or boundary artifacts that shouldn't be separate segments.
    MIN_TURN_DURATION = 0.3
    speaker_turns: list[tuple[float, float, str]] = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        if turn.end - turn.start >= MIN_TURN_DURATION:
            speaker_turns.append((turn.start, turn.end, speaker))

    # Build diarization-driven segments by merging transcription text
    # onto each pyannote speaker turn
    result = _merge_transcription_into_diarization(
        transcription_segments, speaker_turns
    )

    logger.info(
        f"Diarization produced {len(speaker_turns)} speaker turns → "
        f"{len(result)} segments after merging transcription text "
        f"(from {len(transcription_segments)} Whisper segments)"
    )
    return result


def _merge_transcription_into_diarization(
    transcription_segments: list[dict],
    speaker_turns: list[tuple[float, float, str]],
) -> list[dict]:
    """
    Merge transcription text onto diarization speaker turns.

    Each Whisper segment is assigned to exactly ONE diarization turn — the one
    with the most temporal overlap. This prevents duplicate text when pyannote
    produces overlapping speaker turns (e.g. during crosstalk or due to
    imprecise boundaries).

    Args:
        transcription_segments: Whisper output [{start, end, text}, ...]
        speaker_turns: pyannote output [(start, end, speaker_label), ...]

    Returns:
        Merged segments [{start, end, speaker, text}, ...] where boundaries
        come from diarization and text comes from transcription.
    """
    # Step 1: Assign each Whisper segment to its best-matching diarization turn
    # (greedy — each segment goes to the turn with max overlap)
    turn_texts: dict[int, list[str]] = {i: [] for i in range(len(speaker_turns))}

    for tseg in transcription_segments:
        best_turn_idx = -1
        best_overlap = 0.0

        for i, (turn_start, turn_end, _) in enumerate(speaker_turns):
            overlap_start = max(turn_start, tseg["start"])
            overlap_end = min(turn_end, tseg["end"])
            overlap = max(0.0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_turn_idx = i

        if best_turn_idx >= 0:
            turn_texts[best_turn_idx].append(tseg["text"].strip())

    # Step 2: Build output segments from diarization turns that got text
    result = []
    for i, (turn_start, turn_end, speaker) in enumerate(speaker_turns):
        parts = turn_texts.get(i, [])
        if not parts:
            # No Whisper text matched this turn — skip
            continue
        result.append({
            "start": turn_start,
            "end": turn_end,
            "speaker": speaker,
            "text": " ".join(parts),
        })

    return result
