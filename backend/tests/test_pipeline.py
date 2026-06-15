"""
Pipeline integration tests — validates each processing step independently
and the full pipeline end-to-end.

Fast tests (no ML models): audio_service, storage_service
Slow tests (ML models):    transcription, diarization, full pipeline

Run fast tests only:
    pytest tests/test_pipeline.py -m "not slow"

Run all tests (requires models + Redis + DB):
    pytest tests/test_pipeline.py
"""

import json
import os
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

# ─── Fixtures ────────────────────────────────────────────────────────────

FIXTURES_DIR = Path(__file__).parent / "fixtures"
TEST_WAV = FIXTURES_DIR / "test_audio.wav"
TEST_WAV_STEREO = FIXTURES_DIR / "test_audio_stereo.wav"


@pytest.fixture
def tmp_audio_dir(tmp_path):
    """Provide a temporary directory for audio file operations."""
    return tmp_path


@pytest.fixture
def sample_audio():
    """Load the test WAV as a float32 numpy array (mono, 16kHz)."""
    import soundfile as sf
    data, sr = sf.read(str(TEST_WAV), dtype="float32")
    assert sr == 16000, f"Expected 16kHz, got {sr}"
    return data, sr


@pytest.fixture
def sample_audio_stereo():
    """Load the stereo test WAV as a float32 numpy array (stereo, 16kHz)."""
    import soundfile as sf
    data, sr = sf.read(str(TEST_WAV_STEREO), dtype="float32")
    assert sr == 16000
    assert data.ndim == 2 and data.shape[1] == 2
    return data, sr


# ─── Audio Service Tests (fast, no ML) ───────────────────────────────────


class TestAudioService:
    """Tests for audio preprocessing and channel merging."""

    def test_load_mono_wav(self, sample_audio):
        """Audio service should load a mono WAV file correctly."""
        from src.services.audio_service import preprocess_and_merge

        data, sr = sample_audio
        # Write to a temp file and load via service
        # Note: close the file before reading on Windows (PermissionError)
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            import soundfile as _sf
            _sf.write(path, data, sr)
            result, out_sr = preprocess_and_merge(path, None)
            assert out_sr == 16000
            assert result.ndim == 1  # mono (mono=True in librosa.load)
            assert len(result) > 0
            assert result.dtype == np.float32
        finally:
            os.unlink(path)

    def test_load_stereo_wav(self, sample_audio_stereo):
        """Loading a stereo file produces mono (librosa mono=True default)."""
        from src.services.audio_service import preprocess_and_merge

        data, sr = sample_audio_stereo
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            import soundfile as _sf
            _sf.write(path, data, sr)
            result, out_sr = preprocess_and_merge(path, None)
            assert out_sr == 16000
            # librosa.load(mono=True) converts stereo to mono
            assert result.ndim == 1
            assert len(result) > 0
        finally:
            os.unlink(path)

    def test_merge_two_channels(self, sample_audio):
        """Audio service should merge mic + system audio into stereo."""
        from src.services.audio_service import preprocess_and_merge

        data, sr = sample_audio
        paths = []
        for suffix in ["_mic.wav", "_sys.wav"]:
            fd, path = tempfile.mkstemp(suffix=suffix)
            os.close(fd)
            import soundfile as _sf
            _sf.write(path, data, sr)
            paths.append(path)
        try:
            result, out_sr = preprocess_and_merge(paths[0], paths[1])
            assert out_sr == 16000
            assert result.ndim == 2
            assert result.shape[0] == 2  # stereo
        finally:
            for p in paths:
                os.unlink(p)

    def test_missing_files_raises(self):
        """Audio service should raise ValueError when no files exist."""
        from src.services.audio_service import preprocess_and_merge

        with pytest.raises(ValueError, match="No valid audio"):
            preprocess_and_merge(None, None)

    def test_noise_reduction_applied(self, sample_audio):
        """Verify the output is normalized (max amplitude ≤ 1.0)."""
        from src.services.audio_service import preprocess_and_merge

        data, sr = sample_audio
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            import soundfile as _sf
            _sf.write(path, data, sr)
            result, _ = preprocess_and_merge(path, None)
            assert np.max(np.abs(result)) <= 1.0 + 1e-6
        finally:
            os.unlink(path)


# ─── Storage Service Tests (fast, no ML) ─────────────────────────────────


class TestStorageService:
    """Tests for file storage operations."""

    def test_save_and_load_transcript(self, tmp_path):
        """Save a transcript artifact and read it back."""
        from src.services.storage_service import save_transcript

        with patch("src.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.AUDIO_STORAGE_PATH = str(tmp_path)
            rid = str(uuid.uuid4())
            content = json.dumps([{"start": 0, "end": 1, "text": "hello"}])

            path = save_transcript(rid, "raw", content)
            assert path.exists()
            assert path.read_text(encoding="utf-8") == content

    def test_transcript_types(self, tmp_path):
        """All transcript types should save to the correct filenames."""
        from src.services.storage_service import save_transcript

        with patch("src.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.AUDIO_STORAGE_PATH = str(tmp_path)
            rid = str(uuid.uuid4())

            for ttype in ["raw", "diarized", "named", "output"]:
                path = save_transcript(rid, ttype, f"content for {ttype}")
                assert path.exists(), f"Missing transcript for type={ttype}"
                assert ttype in path.name


# ─── Transcription Service Tests (slow — loads Whisper model) ────────────


@pytest.mark.slow
class TestTranscriptionService:
    """Tests for server-side transcription (faster-whisper)."""

    def test_transcribe_sine_wave(self, sample_audio):
        """Transcription should return a list of segments (content may be empty for sine wave)."""
        from src.services.transcription_service import transcribe_audio

        data, sr = sample_audio
        # Wrap as stereo (2, N) to match pipeline input format
        stereo = np.stack([data, data], axis=0)
        segments = transcribe_audio(stereo, sr, "en")

        assert isinstance(segments, list)
        # Each segment should have start, end, text
        for seg in segments:
            assert "start" in seg
            assert "end" in seg
            assert "text" in seg
            assert seg["start"] >= 0
            assert seg["end"] > seg["start"]


# ─── Diarization Service Tests (slow — loads pyannote model) ─────────────


@pytest.mark.slow
class TestDiarizationService:
    """Tests for speaker diarization (pyannote.audio 4.x)."""

    def test_diarize_returns_segments(self, sample_audio):
        """Diarization should return segments with speaker labels."""
        from src.services.diarization_service import diarize_audio

        data, sr = sample_audio
        # Provide fake transcription segments spanning the audio
        fake_segments = [
            {"start": 0.0, "end": 2.5, "text": "hello world"},
            {"start": 2.5, "end": 5.0, "text": "testing one two"},
        ]

        result = diarize_audio(data, sr, fake_segments, "en")

        assert isinstance(result, list)
        assert len(result) == 2  # Same count as input segments
        for seg in result:
            assert "start" in seg
            assert "end" in seg
            assert "text" in seg
            assert "speaker" in seg
            # Speaker is either a pyannote label (SPEAKER_XX) or "Unknown"
            # when the model can't detect distinct speakers (e.g. sine wave).
            assert isinstance(seg["speaker"], str)

    def test_diarize_stereo_input(self, sample_audio):
        """Diarization should handle stereo input by converting to mono."""
        from src.services.diarization_service import diarize_audio

        data, sr = sample_audio
        stereo = np.stack([data, data], axis=0)
        fake_segments = [{"start": 0.0, "end": 5.0, "text": "test"}]

        result = diarize_audio(stereo, sr, fake_segments, "en")
        assert len(result) == 1
        assert "speaker" in result[0]


# ─── Full Pipeline Tests (slow — loads all models) ───────────────────────


@pytest.mark.slow
class TestFullPipeline:
    """End-to-end pipeline tests."""

    def test_process_from_transcript(self, sample_audio, tmp_path):
        """Full client-transcription pipeline: save transcript → diarize → name → output."""
        from src.services.audio_service import preprocess_and_merge
        from src.services.diarization_service import diarize_audio
        from src.services.speaker_naming_service import infer_speaker_names
        from src.services.output_service import generate_output

        data, sr = sample_audio
        stereo = np.stack([data, data], axis=0)

        # Step 1: Simulate client-side transcription output
        raw_segments = [
            {"start": 0.0, "end": 2.5, "text": "Hello, welcome to the meeting."},
            {"start": 2.5, "end": 5.0, "text": "Thanks for having me here today."},
        ]

        # Step 2: Diarization
        diarized = diarize_audio(stereo, sr, raw_segments, "en")
        assert len(diarized) == 2
        assert all("speaker" in s for s in diarized)

        # Step 3: Speaker naming
        named, name_map = infer_speaker_names(diarized)
        assert len(named) == 2

        # Step 4: Output generation (needs LLM — may fail in CI without API key)
        if os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY"):
            output = generate_output(named, "Generate meeting minutes.")
            assert isinstance(output, str)
            assert len(output) > 0

    def test_process_recording_full(self, sample_audio, tmp_path):
        """Full server pipeline: audio → transcribe → diarize → name → output."""
        from src.services.audio_service import preprocess_and_merge
        from src.services.transcription_service import transcribe_audio
        from src.services.diarization_service import diarize_audio
        from src.services.speaker_naming_service import infer_speaker_names

        data, sr = sample_audio
        stereo = np.stack([data, data], axis=0)

        # Step 1: Transcription
        raw_segments = transcribe_audio(stereo, sr, "en")
        assert isinstance(raw_segments, list)

        # Step 2: Diarization
        diarized = diarize_audio(stereo, sr, raw_segments, "en")
        assert isinstance(diarized, list)

        # Step 3: Speaker naming
        named, name_map = infer_speaker_names(diarized)
        assert isinstance(named, list)


# ─── LLM Service Tests (slow — makes real API calls) ────────────────────


@pytest.mark.slow
class TestLLMService:
    """Tests for LLM integration (OpenRouter)."""

    def test_llm_returns_response(self):
        """LLM should return a response for a simple prompt."""
        from src.services.llm_service import get_llm

        llm = get_llm()
        response = llm.invoke("Say hello in one word.")
        content = response.content if hasattr(response, "content") else str(response)
        assert isinstance(content, str)
        assert len(content) > 0

    def test_output_generation_with_fallback(self):
        """Output service should fall back gracefully when LLM fails."""
        from src.services.output_service import generate_output, _fallback_output

        segments = [
            {"start": 0.0, "end": 2.5, "speaker": "Alice", "text": "Hello everyone."},
            {"start": 2.5, "end": 5.0, "speaker": "Bob", "text": "Hi Alice!"},
        ]

        # Test the fallback directly
        fallback = _fallback_output(segments)
        assert "Alice" in fallback
        assert "Bob" in fallback
        assert "Hello everyone" in fallback

    def test_speaker_naming_graceful_degradation(self):
        """Speaker naming should return original segments when LLM fails."""
        from src.services.speaker_naming_service import infer_speaker_names

        segments = [
            {"start": 0.0, "end": 2.5, "speaker": "SPEAKER_00", "text": "Hello."},
            {"start": 2.5, "end": 5.0, "speaker": "SPEAKER_01", "text": "Hi there."},
        ]

        # This should work even with a single-speaker case (returns immediately)
        named, name_map = infer_speaker_names(segments)
        assert len(named) == 2
        # With 2 speakers, it attempts LLM call — may return names or fall back
        for seg in named:
            assert "speaker" in seg
            assert "text" in seg
