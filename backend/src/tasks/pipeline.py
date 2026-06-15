"""Celery pipeline tasks — the core processing pipeline."""

import json
import logging

from celery.signals import worker_ready
from sqlalchemy.orm import Session

from src.celery_app import celery
from src.db.session import SyncSessionLocal
import src.models  # noqa: F401 — ensure all SQLAlchemy models are registered
from src.models.job import Job
from src.models.speaker import Speaker
from src.models.transcript import Transcript
from src.services.audio_service import preprocess_and_merge
from src.services.diarization_service import diarize_audio
from src.services.output_service import generate_output
from src.services.speaker_naming_service import infer_speaker_names
from src.services.storage_service import save_transcript
from src.services.transcription_service import transcribe_audio

logger = logging.getLogger(__name__)


def _update_job(db: Session, job: Job, stage: str, progress: int, error: str | None = None) -> None:
    job.stage = stage
    job.progress = progress
    if error:
        job.error_message = error
    db.commit()


@worker_ready.connect
def on_worker_ready(**kwargs):
    """Pre-load all ML models when worker starts."""
    try:
        from src.services.transcription_service import _get_model
        from src.services.diarization_service import _get_diarization_pipeline
        _get_model()
        _get_diarization_pipeline()
        logger.info("ML models pre-loaded and ready")
    except Exception as e:
        logger.warning(f"Model pre-loading failed (will load on first task): {e}")


# ---------------------------------------------------------------------------
# Full pipeline (server mode)
# ---------------------------------------------------------------------------
@celery.task(bind=True, name="tasks.process_recording", max_retries=0)
def process_recording(self, job_id: str) -> None:
    """Full server-side pipeline: transcribe → diarize → name → generate."""
    with SyncSessionLocal() as db:
        job = db.get(Job, job_id)
        if not job:
            logger.error(f"Job not found: {job_id}")
            return

        recording = job.recording
        template = job.template

        try:
            # ── Stage 1: Transcription ──────────────────────────────
            _update_job(db, job, "transcribing", 10)
            audio_data, sample_rate = preprocess_and_merge(
                mic_path=recording.mic_audio_path,
                system_path=recording.system_audio_path,
            )
            raw_segments = transcribe_audio(audio_data, sample_rate, recording.language)
            raw_content = json.dumps(raw_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="raw",
                content=raw_content,
            ))
            db.commit()
            save_transcript(str(recording.id), "raw", raw_content)
            _update_job(db, job, "transcribing", 25)

            # ── Stage 2: Diarization + Alignment ───────────────────
            _update_job(db, job, "diarizing", 30)
            diarized_segments = diarize_audio(
                audio_data, sample_rate, raw_segments, recording.language
            )
            diarized_content = json.dumps(diarized_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="diarized",
                content=diarized_content,
            ))

            # Save detected speakers
            speaker_labels: set[str] = {seg["speaker"] for seg in diarized_segments}
            for label in sorted(speaker_labels):
                sample = next(
                    (
                        s
                        for s in diarized_segments
                        if s["speaker"] == label and s["end"] - s["start"] >= 2.0
                    ),
                    None,
                )
                db.add(Speaker(
                    recording_id=recording.id,
                    label=label,
                    name=None,
                    sample_start_seconds=sample["start"] if sample else None,
                    sample_end_seconds=sample["end"] if sample else None,
                ))
            db.commit()
            save_transcript(str(recording.id), "diarized", diarized_content)
            _update_job(db, job, "diarizing", 50)

            # ── Stage 3: Speaker Naming ─────────────────────────────
            _update_job(db, job, "naming", 55)
            named_segments, inferred_names = infer_speaker_names(diarized_segments)
            named_content = json.dumps(named_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="named",
                content=named_content,
            ))

            # Update speaker names from LLM inference
            for speaker in db.query(Speaker).filter_by(recording_id=recording.id).all():
                if speaker.label in inferred_names:
                    speaker.name = inferred_names[speaker.label]
            db.commit()
            save_transcript(str(recording.id), "named", named_content)
            _update_job(db, job, "naming", 75)

            # ── Stage 4: Output Generation ──────────────────────────
            _update_job(db, job, "generating", 80)
            system_prompt = template.system_prompt if template else _default_prompt()
            output_content = generate_output(named_segments, system_prompt)

            db.add(Transcript(
                recording_id=recording.id,
                type="output",
                content=output_content,
                template_id=template.id if template else None,
            ))
            db.commit()
            save_transcript(str(recording.id), "output", output_content)
            _update_job(db, job, "done", 100)

            logger.info(f"Pipeline completed for job {job_id}")

        except Exception as exc:
            logger.exception(f"Pipeline failed for job {job_id}: {exc}")
            _update_job(db, job, "failed", job.progress, error=str(exc))
            raise


# ---------------------------------------------------------------------------
# Client-transcription pipeline
# ---------------------------------------------------------------------------
@celery.task(bind=True, name="tasks.process_from_transcript", max_retries=0)
def process_from_transcript(self, job_id: str, transcript_json: str) -> None:
    """
    Client-side transcription mode:
    Frontend ran Whisper ONNX locally, uploaded the raw transcript JSON.
    Backend skips transcription, starts from diarization.
    """
    with SyncSessionLocal() as db:
        job = db.get(Job, job_id)
        if not job:
            logger.error(f"Job not found: {job_id}")
            return

        recording = job.recording
        template = job.template

        try:
            # ── Stage 1: Save client-provided raw transcript ─────────
            raw_segments = json.loads(transcript_json)
            raw_content = json.dumps(raw_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="raw",
                content=raw_content,
            ))
            db.commit()
            save_transcript(str(recording.id), "raw", raw_content)
            _update_job(db, job, "diarizing", 25)

            # ── Stage 2: Diarization + Alignment ───────────────────
            audio_data, sample_rate = preprocess_and_merge(
                mic_path=recording.mic_audio_path,
                system_path=recording.system_audio_path,
            )
            diarized_segments = diarize_audio(
                audio_data, sample_rate, raw_segments, recording.language
            )
            diarized_content = json.dumps(diarized_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="diarized",
                content=diarized_content,
            ))

            speaker_labels: set[str] = {seg["speaker"] for seg in diarized_segments}
            for label in sorted(speaker_labels):
                sample = next(
                    (
                        s
                        for s in diarized_segments
                        if s["speaker"] == label and s["end"] - s["start"] >= 2.0
                    ),
                    None,
                )
                db.add(Speaker(
                    recording_id=recording.id,
                    label=label,
                    name=None,
                    sample_start_seconds=sample["start"] if sample else None,
                    sample_end_seconds=sample["end"] if sample else None,
                ))
            db.commit()
            save_transcript(str(recording.id), "diarized", diarized_content)
            _update_job(db, job, "diarizing", 50)

            # ── Stage 3: Speaker Naming ─────────────────────────────
            _update_job(db, job, "naming", 55)
            named_segments, inferred_names = infer_speaker_names(diarized_segments)
            named_content = json.dumps(named_segments, ensure_ascii=False)

            db.add(Transcript(
                recording_id=recording.id,
                type="named",
                content=named_content,
            ))
            for speaker in db.query(Speaker).filter_by(recording_id=recording.id).all():
                if speaker.label in inferred_names:
                    speaker.name = inferred_names[speaker.label]
            db.commit()
            save_transcript(str(recording.id), "named", named_content)
            _update_job(db, job, "naming", 75)

            # ── Stage 4: Output Generation ──────────────────────────
            _update_job(db, job, "generating", 80)
            system_prompt = template.system_prompt if template else _default_prompt()
            output_content = generate_output(named_segments, system_prompt)

            db.add(Transcript(
                recording_id=recording.id,
                type="output",
                content=output_content,
                template_id=template.id if template else None,
            ))
            db.commit()
            save_transcript(str(recording.id), "output", output_content)
            _update_job(db, job, "done", 100)

            logger.info(f"Client pipeline completed for job {job_id}")

        except Exception as exc:
            logger.exception(f"Client pipeline failed for job {job_id}: {exc}")
            _update_job(db, job, "failed", job.progress, error=str(exc))
            raise


def _default_prompt() -> str:
    return (
        "Generate clear, structured meeting minutes from the following transcript. "
        "Include: attendees (if identifiable), key discussion points, decisions made, "
        "and action items with owners. Use markdown formatting."
    )
