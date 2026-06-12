# QuillVault v2 — Backend Development Guide
> FastAPI + PostgreSQL + Celery + LangChain
> Supports dual transcription: client-side (Whisper ONNX) or server-side (faster-whisper)

---

## 0. Core Principle: Standalone, Repeatable Pipeline Steps

**Every processing step is standalone, repeatable, and produces a viewable artifact.**

```
RECORDING → TRANSCRIPTION → DIARIZATION → SPEAKER NAMING → OUTPUT GENERATION
   │              │               │                │                │
   ↓              ↓               ↓                ↓                ↓
 Audio files  Raw transcript  Diarized        Named             Final
 (mic.webm)   JSON            transcript      transcript        output
               (viewable)     JSON            JSON              (markdown)
                              (viewable)      (viewable)        (viewable)
```

**Key rules:**
1. **Each step is independently runnable** — If transcription succeeds but diarization fails, transcription output is preserved. User can retry just diarization.
2. **Each step is repeatable** — User can re-run transcription with a different model, or re-run naming with different speaker assignments.
3. **Each step's output is stored and viewable** — All intermediate artifacts (raw transcript, diarized transcript, named transcript, output) are saved to disk and can be viewed in the Document Viewer at any time.
4. **Error isolation** — A failure in one step does NOT corrupt outputs of previous steps. The job tracks which step failed and preserves all completed artifacts.
5. **Steps can be skipped** — If the user provides a client-side transcript, the backend skips the transcription step and starts from diarization.
6. **Pipeline is configurable** — User can choose which steps to run (e.g., skip diarization, use a different template for output).

**Storage per recording:**
```
/data/recordings/{recording_id}/
├── mic_audio.webm          # Original mic recording
├── system_audio.webm       # Original system audio (optional)
├── transcripts/
│   ├── raw.json            # Step 1: Raw transcript
│   ├── diarized.json       # Step 2: Diarized transcript
│   ├── named.json          # Step 3: Named transcript
│   └── output.md           # Step 4: Generated output
└── metadata.json           # Recording metadata + pipeline state
```

This philosophy applies to BOTH the backend pipeline AND the frontend local transcription workflow.

---

## 1. Technology Stack

| Concern | Technology | Version |
|---------|-----------|---------|
| API framework | FastAPI | 0.115.x |
| ASGI server | Uvicorn + Gunicorn | latest |
| ORM | SQLAlchemy 2.x (async) | 2.x |
| Migrations | Alembic | 1.x |
| Database | PostgreSQL | 16.x |
| Task queue | Celery | 5.x |
| Message broker | Redis | 7.x |
| Auth | python-jose + passlib (bcrypt) | latest |
| File uploads | python-multipart | latest |
| Async file I/O | aiofiles | latest |
| Transcription (server) | faster-whisper | 1.x |
| Diarization | pyannote.audio | 3.x |
| Audio processing | librosa + noisereduce | latest |
| Alignment | whisperx | latest |
| LLM abstraction | LangChain + langchain-openai | 0.3.x |
| HTTP client (LLM) | httpx | latest |
| Validation | Pydantic v2 | 2.x |
| Config | pydantic-settings | 2.x |
| Logging | structlog | latest |
| Storage | local filesystem (S3-compatible interface) | — |

### 1.1 Dual Transcription Mode

The backend supports two ingestion modes:

| Mode | How it works | When to use |
|------|-------------|-------------|
| **Server-transcribed** | Client uploads raw audio → backend runs faster-whisper → full pipeline | Better accuracy (larger models), no client-side compute |
| **Client-transcribed** | Client runs Whisper ONNX locally → uploads raw transcript JSON → backend runs diarization + naming + output | Faster, works offline for transcription, lower bandwidth |

The `POST /recordings` endpoint accepts an optional `transcript` field:
- **If `transcript` is absent**: backend transcribes the audio (server mode)
- **If `transcript` is present**: backend skips transcription and goes directly to diarization → naming → output generation (client mode)

This is transparent to the rest of the pipeline — diarization, speaker naming, and output generation work the same regardless of transcription source.

---

## 2. Project Structure

```
backend/
├── pyproject.toml               # Dependencies (use uv or pip)
├── alembic.ini
├── alembic/
│   └── versions/
│
└── src/
    ├── main.py                  # FastAPI app factory
    ├── config.py                # Settings via pydantic-settings
    ├── celery_app.py            # Celery instance
    │
    ├── api/                     # Routers (thin — delegate to services)
    │   ├── deps.py              # Shared dependencies (get_db, get_current_user)
    │   ├── auth.py              # POST /auth/login, /auth/register, /auth/refresh
    │   ├── recordings.py        # POST /recordings, GET /recordings, GET /recordings/{id}
    │   ├── jobs.py              # GET /jobs/{job_id}/status
    │   ├── transcripts.py       # GET /recordings/{id}/transcripts
    │   ├── speakers.py          # GET/PUT /recordings/{id}/speakers
    │   ├── templates.py         # CRUD /templates
    │   ├── chat.py              # POST /recordings/{id}/chat
    │   └── output.py            # POST /recordings/{id}/generate
    │
    ├── models/                  # SQLAlchemy ORM models
    │   ├── base.py
    │   ├── user.py
    │   ├── recording.py
    │   ├── job.py
    │   ├── transcript.py
    │   ├── speaker.py
    │   ├── template.py
    │   └── chat_message.py
    │
    ├── schemas/                 # Pydantic request/response schemas
    │   ├── auth.py
    │   ├── recording.py
    │   ├── job.py
    │   ├── transcript.py
    │   ├── speaker.py
    │   ├── template.py
    │   └── chat.py
    │
    ├── services/                # Business logic
    │   ├── auth_service.py
    │   ├── recording_service.py
    │   ├── audio_service.py     # preprocess, merge channels
    │   ├── transcription_service.py   # faster-whisper wrapper
    │   ├── diarization_service.py     # pyannote wrapper
    │   ├── alignment_service.py       # whisperx align wrapper
    │   ├── speaker_naming_service.py  # LLM: infer names from context
    │   ├── output_service.py          # LLM: apply template
    │   ├── chat_service.py            # RAG + LLM chat
    │   ├── storage_service.py         # File save/load abstraction
    │   └── email_service.py
    │
    ├── tasks/                   # Celery tasks
    │   └── pipeline.py          # process_recording_task
    │
    ├── db/
    │   └── session.py           # async sessionmaker, get_db dependency
    │
    └── utils/
        ├── logger.py
        └── security.py          # password hash, JWT
```

---

## 3. Configuration

```python
# src/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    # App
    APP_NAME: str = 'QuillVault API'
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ['*']

    # Database
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host/db

    # Redis / Celery
    REDIS_URL: str = 'redis://localhost:6379/0'
    CELERY_BROKER_URL: str = 'redis://localhost:6379/0'
    CELERY_RESULT_BACKEND: str = 'redis://localhost:6379/0'

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Storage
    AUDIO_STORAGE_PATH: str = '/data/audio'
    MAX_AUDIO_SIZE_MB: int = 2048

    # Models
    WHISPER_MODEL: str = 'large-v3'       # faster-whisper model size
    WHISPER_DEVICE: str = 'cpu'           # 'cpu' or 'cuda'
    WHISPER_COMPUTE_TYPE: str = 'float32' # 'float32', 'float16', 'int8'
    DIARIZATION_MODEL: str = 'pyannote/speaker-diarization-3.1'
    HUGGINGFACE_TOKEN: str = ''
    EMBEDDING_SIMILARITY_THRESHOLD: float = 0.30

    # LLM (LangChain / OpenRouter)
    LLM_PROVIDER: str = 'openrouter'
    LLM_API_KEY: str = ''
    LLM_MODEL: str = 'meta-llama/llama-3.1-8b-instruct:free'
    LLM_BASE_URL: str = 'https://openrouter.ai/api/v1'
    LLM_MAX_TOKENS: int = 4096

    # Email
    SMTP_HOST: str = ''
    SMTP_PORT: int = 587
    SMTP_USER: str = ''
    SMTP_PASSWORD: str = ''
    SMTP_FROM: str = ''

    BACKEND_URL: str = 'http://localhost:8000'


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## 4. Database Models

```python
# src/models/base.py
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )
```

```python
# src/models/user.py
import uuid
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = 'users'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), default='')
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    recordings: Mapped[list['Recording']] = relationship(back_populates='user')
    templates: Mapped[list['Template']] = relationship(back_populates='user')
```

```python
# src/models/recording.py
import uuid
from sqlalchemy import String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class Recording(Base, TimestampMixin):
    __tablename__ = 'recordings'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(10), default='en')
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    mic_audio_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    system_audio_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    user: Mapped['User'] = relationship(back_populates='recordings')
    jobs: Mapped[list['Job']] = relationship(back_populates='recording')
    transcripts: Mapped[list['Transcript']] = relationship(back_populates='recording')
    speakers: Mapped[list['Speaker']] = relationship(back_populates='recording')
    chat_messages: Mapped[list['ChatMessage']] = relationship(back_populates='recording')
```

```python
# src/models/job.py
import uuid
from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

# Possible stages, in order:
# Server mode:  queued → transcribing → diarizing → naming → generating → done
# Client mode:  queued → diarizing → naming → generating → done
# Any stage can transition to: failed

class Job(Base, TimestampMixin):
    __tablename__ = 'jobs'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('recordings.id'), index=True)
    stage: Mapped[str] = mapped_column(String(32), default='queued')
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0–100
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('templates.id'), nullable=True
    )
    # 'server' = full pipeline on backend, 'client' = transcript uploaded from frontend
    transcription_mode: Mapped[str] = mapped_column(String(16), default='server')

    recording: Mapped['Recording'] = relationship(back_populates='jobs')
```

```python
# src/models/transcript.py
import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

# type values: 'raw' | 'diarized' | 'named' | 'output'
# content is JSON string (list of segments) for raw/diarized/named
# content is markdown string for 'output'

class Transcript(Base, TimestampMixin):
    __tablename__ = 'transcripts'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('recordings.id'), index=True)
    type: Mapped[str] = mapped_column(String(16), index=True)  # raw/diarized/named/output
    content: Mapped[str] = mapped_column(Text)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('templates.id'), nullable=True
    )  # only for type='output'

    recording: Mapped['Recording'] = relationship(back_populates='transcripts')
```

```python
# src/models/speaker.py
import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class Speaker(Base, TimestampMixin):
    __tablename__ = 'speakers'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('recordings.id'), index=True)
    label: Mapped[str] = mapped_column(String(32))   # e.g. "Speaker 01"
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # e.g. "Alice"
    sample_start_seconds: Mapped[float | None] = mapped_column(nullable=True)
    sample_end_seconds: Mapped[float | None] = mapped_column(nullable=True)

    recording: Mapped['Recording'] = relationship(back_populates='speakers')
```

```python
# src/models/template.py
import uuid
from sqlalchemy import String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class Template(Base, TimestampMixin):
    __tablename__ = 'templates'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('users.id'), nullable=True, index=True
    )  # None = built-in template
    name: Mapped[str] = mapped_column(String(128))
    icon: Mapped[str] = mapped_column(String(16), default='📋')
    category: Mapped[str] = mapped_column(String(64), default='General')
    system_prompt: Mapped[str] = mapped_column(Text)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped['User | None'] = relationship(back_populates='templates')
```

```python
# src/models/chat_message.py
import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class ChatMessage(Base, TimestampMixin):
    __tablename__ = 'chat_messages'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('recordings.id'), index=True)
    role: Mapped[str] = mapped_column(String(16))   # 'user' | 'assistant' | 'system'
    content: Mapped[str] = mapped_column(Text)

    recording: Mapped['Recording'] = relationship(back_populates='chat_messages')
```

---

## 5. API Endpoints

### 5.1 Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account, send verification email |
| POST | `/auth/login` | Username/email + password → tokens |
| POST | `/auth/refresh` | Rotate access + refresh tokens |
| GET | `/auth/verify` | Email verification via token link |
| POST | `/auth/forgot-password` | Send OTP to email |
| POST | `/auth/reset-password` | OTP + new password |

### 5.2 Recordings

| Method | Path | Description |
|--------|------|-------------|
| POST | `/recordings` | Upload mic + system audio, optionally with client-side transcript JSON, create job |
| POST | `/recordings/{id}/transcript` | Upload client-side raw transcript JSON for an existing recording (client-transcribed mode) |
| GET | `/recordings` | List user's recordings (paginated) |
| GET | `/recordings/{id}` | Recording detail + active job ID |
| PATCH | `/recordings/{id}` | Rename recording |
| DELETE | `/recordings/{id}` | Delete recording + all associated data |

### 5.3 Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs/{job_id}/status` | Poll job status + progress |

### 5.4 Transcripts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recordings/{id}/transcripts` | All transcript types for recording |
| GET | `/recordings/{id}/transcripts/{type}` | Specific type: raw/diarized/named/output |

### 5.5 Speakers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recordings/{id}/speakers` | List speakers with labels + names |
| PUT | `/recordings/{id}/speakers` | Bulk update speaker names → triggers re-naming |
| GET | `/recordings/{id}/speakers/{label}/sample` | Return audio clip for speaker label |

### 5.6 Output Generation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/recordings/{id}/generate` | Re-generate output with given template |

### 5.7 Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List built-in + user's templates |
| POST | `/templates` | Create custom template |
| PUT | `/templates/{id}` | Update custom template |
| DELETE | `/templates/{id}` | Delete custom template (not built-in) |

### 5.8 Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recordings/{id}/chat` | Get chat history |
| POST | `/recordings/{id}/chat` | Send message → streaming response |

---

## 6. Processing Pipeline (Celery)

### 6.1 Architecture

```
POST /recordings
│
├── Save audio files to disk
├── Create Recording row
├── Create Job row (stage='queued', transcription_mode='server' | 'client')
│
├─── If transcription_mode='server':
│    ├── Enqueue: process_recording_full.delay(job_id)
│    └── Return { recording_id, job_id }
│
├─── If transcription_mode='client':
│    ├── If transcript JSON provided in upload: save it, enqueue process_from_transcript.delay(job_id)
│    ├── If no transcript yet: return { recording_id, job_id } (client will POST transcript later)
│    └── Client then POST /recordings/{id}/transcript → triggers process_from_transcript
│

                    Celery Worker — FULL PIPELINE (server mode)
                    ┌──────────────────────────────────────────────────────────────┐
                    │                                                              │
                    │  process_recording_full(job_id)                              │
                    │                                                              │
                    │  1. stage='transcribing'  → run faster-whisper              │
                    │     → save Transcript(type='raw')                           │
                    │     → progress=25                                            │
                    │                                                              │
                    │  2. stage='diarizing'     → run pyannote diarization        │
                    │     → run whisperx alignment                                │
                    │     → save Transcript(type='diarized')                      │
                    │     → save Speaker rows                                      │
                    │     → progress=50                                            │
                    │                                                              │
                    │  3. stage='naming'        → LangChain: infer speaker names  │
                    │     → save named transcript Transcript(type='named')        │
                    │     → update Speaker.name rows                              │
                    │     → progress=75                                            │
                    │                                                              │
                    │  4. stage='generating'    → LangChain: apply template       │
                    │     → save Transcript(type='output', template_id=...)       │
                    │     → progress=100                                           │
                    │                                                              │
                    │  5. stage='done'                                             │
                    │                                                              │
                    │  On any exception: stage='failed', error_message=str(e)     │
                    └──────────────────────────────────────────────────────────────┘
```

### 6.2 Celery App

```python
# src/celery_app.py
from celery import Celery
from src.config import get_settings

settings = get_settings()

celery = Celery(
    'quillvault',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=['src.tasks.pipeline'],
)

celery.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    task_acks_late=True,           # Ack only after task completes (crash safety)
    worker_prefetch_multiplier=1,  # One task per worker (heavy ML tasks)
    task_track_started=True,
)
```

### 6.3 Pipeline Task

```python
# src/tasks/pipeline.py
import logging
from uuid import UUID
from sqlalchemy.orm import Session
from src.celery_app import celery
from src.db.session import SyncSessionLocal  # sync session for Celery
from src.models.job import Job
from src.models.transcript import Transcript
from src.models.speaker import Speaker
from src.services.audio_service import preprocess_and_merge
from src.services.transcription_service import transcribe_audio
from src.services.diarization_service import diarize_audio
from src.services.alignment_service import align_transcript
from src.services.speaker_naming_service import infer_speaker_names
from src.services.output_service import generate_output
import json


def _update_job(db: Session, job: Job, stage: str, progress: int,
                error: str | None = None) -> None:
    job.stage = stage
    job.progress = progress
    if error:
        job.error_message = error
    db.commit()


@celery.task(bind=True, name='tasks.process_recording', max_retries=0)
def process_recording(self, job_id: str) -> None:
    with SyncSessionLocal() as db:
        job = db.get(Job, UUID(job_id))
        if not job:
            logging.error(f'Job not found: {job_id}')
            return

        recording = job.recording
        template = job.template

        try:
            # ── Stage 1: Transcription ──────────────────────────────
            _update_job(db, job, 'transcribing', 10)
            audio_data, sample_rate = preprocess_and_merge(
                mic_path=recording.mic_audio_path,
                system_path=recording.system_audio_path,
            )
            raw_segments = transcribe_audio(audio_data, sample_rate, recording.language)
            raw_content = json.dumps(raw_segments, ensure_ascii=False)
            db.add(Transcript(
                recording_id=recording.id,
                type='raw',
                content=raw_content,
            ))
            db.commit()
            _update_job(db, job, 'transcribing', 25)

            # ── Stage 2: Diarization + Alignment ───────────────────
            _update_job(db, job, 'diarizing', 30)
            diarized_segments = diarize_audio(audio_data, sample_rate, raw_segments, recording.language)
            diarized_content = json.dumps(diarized_segments, ensure_ascii=False)
            db.add(Transcript(
                recording_id=recording.id,
                type='diarized',
                content=diarized_content,
            ))

            # Save detected speakers
            speaker_labels: set[str] = {seg['speaker'] for seg in diarized_segments}
            for i, label in enumerate(sorted(speaker_labels)):
                # Find a sample clip for this speaker
                sample = next(
                    (s for s in diarized_segments if s['speaker'] == label and
                     s['end'] - s['start'] >= 2.0),
                    None
                )
                db.add(Speaker(
                    recording_id=recording.id,
                    label=label,
                    name=None,
                    sample_start_seconds=sample['start'] if sample else None,
                    sample_end_seconds=sample['end'] if sample else None,
                ))
            db.commit()
            _update_job(db, job, 'diarizing', 50)

            # ── Stage 3: Speaker Naming ─────────────────────────────
            _update_job(db, job, 'naming', 55)
            named_segments, inferred_names = infer_speaker_names(diarized_segments)
            named_content = json.dumps(named_segments, ensure_ascii=False)
            db.add(Transcript(
                recording_id=recording.id,
                type='named',
                content=named_content,
            ))
            # Update speaker names from LLM inference
            for speaker in db.query(Speaker).filter_by(recording_id=recording.id).all():
                if speaker.label in inferred_names:
                    speaker.name = inferred_names[speaker.label]
            db.commit()
            _update_job(db, job, 'naming', 75)

            # ── Stage 4: Output Generation ──────────────────────────
            _update_job(db, job, 'generating', 80)
            system_prompt = template.system_prompt if template else _default_prompt()
            output_content = generate_output(named_segments, system_prompt)
            db.add(Transcript(
                recording_id=recording.id,
                type='output',
                content=output_content,
                template_id=template.id if template else None,
            ))
            db.commit()
            _update_job(db, job, 'done', 100)

        except Exception as exc:
            logging.exception(f'Pipeline failed for job {job_id}: {exc}')
            _update_job(db, job, 'failed', job.progress, error=str(exc))
            raise


def _default_prompt() -> str:
    return (
        'Generate clear, structured meeting minutes from the following transcript. '
        'Include: attendees (if identifiable), key discussion points, decisions made, '
        'and action items with owners. Use markdown formatting.'
    )
```

### 6.4 Client-Transcription Pipeline Task

When the frontend provides a pre-computed transcript (local Whisper ONNX), the backend skips transcription and starts from diarization:

```python
# src/tasks/pipeline.py (continued)

@celery.task(bind=True, name='tasks.process_from_transcript', max_retries=0)
def process_from_transcript(self, job_id: str, transcript_json: str) -> None:
    """
    Client-side transcription mode:
    Frontend ran Whisper ONNX locally, uploaded the raw transcript JSON.
    Backend skips transcription, starts from diarization.
    """
    with SyncSessionLocal() as db:
        job = db.get(Job, UUID(job_id))
        if not job:
            logging.error(f'Job not found: {job_id}')
            return

        recording = job.recording
        template = job.template

        try:
            # ── Stage 1: Save client-provided raw transcript ─────────
            raw_segments = json.loads(transcript_json)
            raw_content = json.dumps(raw_segments, ensure_ascii=False)
            db.add(Transcript(
                recording_id=recording.id,
                type='raw',
                content=raw_content,
            ))
            db.commit()
            _update_job(db, job, 'diarizing', 25)

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
                type='diarized',
                content=diarized_content,
            ))

            # Save detected speakers
            speaker_labels: set[str] = {seg['speaker'] for seg in diarized_segments}
            for label in sorted(speaker_labels):
                sample = next(
                    (s for s in diarized_segments if s['speaker'] == label and
                     s['end'] - s['start'] >= 2.0),
                    None
                )
                db.add(Speaker(
                    recording_id=recording.id,
                    label=label,
                    name=None,
                    sample_start_seconds=sample['start'] if sample else None,
                    sample_end_seconds=sample['end'] if sample else None,
                ))
            db.commit()
            _update_job(db, job, 'diarizing', 50)

            # ── Stage 3: Speaker Naming ─────────────────────────────
            _update_job(db, job, 'naming', 55)
            named_segments, inferred_names = infer_speaker_names(diarized_segments)
            named_content = json.dumps(named_segments, ensure_ascii=False)
            db.add(Transcript(
                recording_id=recording.id,
                type='named',
                content=named_content,
            ))
            for speaker in db.query(Speaker).filter_by(recording_id=recording.id).all():
                if speaker.label in inferred_names:
                    speaker.name = inferred_names[speaker.label]
            db.commit()
            _update_job(db, job, 'naming', 75)

            # ── Stage 4: Output Generation ──────────────────────────
            _update_job(db, job, 'generating', 80)
            system_prompt = template.system_prompt if template else _default_prompt()
            output_content = generate_output(named_segments, system_prompt)
            db.add(Transcript(
                recording_id=recording.id,
                type='output',
                content=output_content,
                template_id=template.id if template else None,
            ))
            db.commit()
            _update_job(db, job, 'done', 100)

        except Exception as exc:
            logging.exception(f'Client pipeline failed for job {job_id}: {exc}')
            _update_job(db, job, 'failed', job.progress, error=str(exc))
            raise
```

---

## 7. Services

### 7.1 Audio Service

```python
# src/services/audio_service.py
"""
Handles loading, preprocessing, and merging of mic + system audio channels.

Strategy:
- If both channels present: mix mic (primary) and system into a 2-channel array.
  Channel 0 = mic (local user). Channel 1 = system (remote participants).
  This allows diarization to use channel information for improved accuracy.
- If only mic: mono array.
- All output: float32, 16kHz, numpy ndarray shape (channels, samples) or (samples,)
"""
import librosa
import numpy as np
import noisereduce as nr
from pathlib import Path

TARGET_SR = 16_000


def preprocess_and_merge(
    mic_path: str | None,
    system_path: str | None,
) -> tuple[np.ndarray, int]:
    """Returns (audio_array, sample_rate). audio_array shape: (samples,) mono or (2, samples) stereo."""
    mic = _load_and_clean(mic_path) if mic_path and Path(mic_path).exists() else None
    sys = _load_and_clean(system_path) if system_path and Path(system_path).exists() else None

    if mic is not None and sys is not None:
        # Align lengths
        length = min(len(mic), len(sys))
        return np.stack([mic[:length], sys[:length]], axis=0), TARGET_SR

    if mic is not None:
        return mic, TARGET_SR

    if sys is not None:
        return sys, TARGET_SR

    raise ValueError('No valid audio files provided')


def _load_and_clean(path: str) -> np.ndarray:
    y, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    y = nr.reduce_noise(y=y, sr=TARGET_SR, prop_decrease=0.6, stationary=True)
    y = y / (np.max(np.abs(y)) + 1e-8)
    return y.astype(np.float32)
```

### 7.2 Transcription Service

```python
# src/services/transcription_service.py
"""
Singleton faster-whisper model. Load once at startup, reuse for all tasks.
Thread safety: faster-whisper is not thread-safe with CUDA; Celery's
worker_prefetch_multiplier=1 ensures only one task runs at a time per worker.
"""
import os
import logging
import numpy as np
from functools import lru_cache
from faster_whisper import WhisperModel
from src.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _get_model() -> WhisperModel:
    model = WhisperModel(
        settings.WHISPER_MODEL,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
    logging.info(f'Whisper model loaded: {settings.WHISPER_MODEL}')
    return model


def transcribe_audio(audio: np.ndarray, sample_rate: int, language: str) -> list[dict]:
    """
    Args:
        audio: float32 numpy array. If stereo (2, N), use mic channel (0) for transcription.
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
        vad_parameters={'min_silence_duration_ms': 500},
    )
    return [{'start': s.start, 'end': s.end, 'text': s.text.strip()} for s in segments]
```

### 7.3 Diarization Service

```python
# src/services/diarization_service.py
"""
pyannote.audio speaker diarization + whisperx alignment.

If stereo audio (2 channels): inform pyannote about channel layout.
Channel 0 = mic (single local speaker). Channel 1 = system audio (remote participants).
This dramatically improves diarization accuracy for call-style recordings.
"""
import logging
import numpy as np
import torch
from functools import lru_cache
from pyannote.audio import Pipeline
import whisperx
from src.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _get_diarization_pipeline() -> Pipeline:
    pipeline = Pipeline.from_pretrained(
        settings.DIARIZATION_MODEL,
        use_auth_token=settings.HUGGINGFACE_TOKEN,
    )
    device = torch.device('cuda' if settings.WHISPER_DEVICE == 'cuda' else 'cpu')
    pipeline.to(device)
    logging.info('Diarization pipeline loaded')
    return pipeline


def diarize_audio(
    audio: np.ndarray,
    sample_rate: int,
    transcription_segments: list[dict],
    language: str,
) -> list[dict]:
    """
    Returns list of {start, end, speaker, text} dicts.
    """
    pipeline = _get_diarization_pipeline()

    # Prepare input
    if audio.ndim == 2:
        # Stereo: average channels for diarization, but keep structure
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    waveform = torch.from_numpy(mono).unsqueeze(0)
    diarization = pipeline({'waveform': waveform, 'sample_rate': sample_rate})

    # Build segment→speaker mapping
    speaker_map: list[tuple[float, float, str]] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_map.append((turn.start, turn.end, speaker))

    # Assign speaker to each transcription segment
    result = []
    for seg in transcription_segments:
        mid = (seg['start'] + seg['end']) / 2
        speaker = _find_speaker(mid, speaker_map)
        result.append({
            'start': seg['start'],
            'end': seg['end'],
            'speaker': speaker,
            'text': seg['text'],
        })

    return result


def _find_speaker(time: float, speaker_map: list[tuple[float, float, str]]) -> str:
    for start, end, speaker in speaker_map:
        if start <= time <= end:
            return speaker
    return 'Unknown'
```

### 7.4 Speaker Naming Service (LangChain)

```python
# src/services/speaker_naming_service.py
"""
Uses LLM to infer real speaker names from transcript context.
Returns named transcript segments + inferred name mapping.
"""
import json
import re
import logging
from src.services.llm_service import get_llm


def infer_speaker_names(
    segments: list[dict],
) -> tuple[list[dict], dict[str, str]]:
    """
    Args:
        segments: [{start, end, speaker, text}, ...]
    Returns:
        named_segments: same structure but speaker field replaced with name if found
        name_map: {'SPEAKER_00': 'Alice', ...}
    """
    speaker_labels = list({s['speaker'] for s in segments})
    if len(speaker_labels) <= 1:
        return segments, {}

    # Build a sample of the transcript for context
    sample_text = _build_sample(segments, max_chars=4000)

    llm = get_llm()
    prompt = f"""You are analyzing a meeting transcript. Based on the content, 
identify real names for the following speakers if they can be inferred 
(e.g. someone is addressed by name, introduces themselves, or signs off).

Speakers: {', '.join(speaker_labels)}

Transcript sample:
{sample_text}

Respond ONLY with a JSON object mapping speaker labels to names.
If a name cannot be confidently inferred, use null.
Example: {{"SPEAKER_00": "Alice", "SPEAKER_01": null}}

JSON response:"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        # Extract JSON from response
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if not match:
            return segments, {}
        name_map: dict[str, str | None] = json.loads(match.group())
        # Filter out nulls
        name_map = {k: v for k, v in name_map.items() if v}
    except Exception as e:
        logging.warning(f'Speaker naming LLM call failed: {e}')
        return segments, {}

    # Apply names to segments
    named = []
    for seg in segments:
        label = seg['speaker']
        named.append({**seg, 'speaker': name_map.get(label, label)})

    return named, {k: v for k, v in name_map.items() if v}


def _build_sample(segments: list[dict], max_chars: int) -> str:
    lines = [f"{s['speaker']}: {s['text']}" for s in segments]
    sample = '\n'.join(lines)
    return sample[:max_chars] + ('...' if len(sample) > max_chars else '')
```

### 7.5 LLM Service (LangChain)

```python
# src/services/llm_service.py
"""
LangChain LLM instance. Provider-agnostic via langchain-openai with configurable base_url.
Supports: OpenRouter, OpenAI, any OpenAI-compatible endpoint (Ollama, LM Studio, etc.)
"""
from functools import lru_cache
from langchain_openai import ChatOpenAI
from src.config import get_settings


@lru_cache(maxsize=1)
def get_llm() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
        max_tokens=settings.LLM_MAX_TOKENS,
        temperature=0.3,
    )
```

**Provider configuration:**

| Provider | `LLM_BASE_URL` | Free models |
|----------|----------------|-------------|
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-2-9b-it:free` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1:8b`, `mistral:7b` |
| OpenAI | `https://api.openai.com/v1` | — (paid) |

### 7.6 Output Generation Service

```python
# src/services/output_service.py
from src.services.llm_service import get_llm


def generate_output(named_segments: list[dict], system_prompt: str) -> str:
    """Returns generated markdown string."""
    transcript_text = '\n'.join(
        f"{s['speaker']}: {s['text']}" for s in named_segments
    )

    llm = get_llm()
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': f'Transcript:\n\n{transcript_text}'},
    ]
    response = llm.invoke(messages)
    content = response.content if hasattr(response, 'content') else str(response)

    # Strip code fences if present
    content = content.strip()
    if content.startswith('```'):
        lines = content.split('\n')
        content = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])

    return content
```

### 7.7 Chat Service (RAG)

```python
# src/services/chat_service.py
"""
Simple RAG: embed transcript chunks into ChromaDB at recording creation.
On chat: retrieve relevant chunks, send with user question to LLM.
"""
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from src.services.llm_service import get_llm
from src.config import get_settings
import json

settings = get_settings()
CHROMA_PATH = '/data/chroma'


def build_vector_store(recording_id: str, named_segments: list[dict]) -> None:
    text = '\n'.join(f"{s['speaker']}: {s['text']}" for s in named_segments)
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(text)
    embeddings = _get_embeddings()
    Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name=f'rec_{recording_id}',
        persist_directory=CHROMA_PATH,
    )


def chat_with_transcript(
    recording_id: str,
    question: str,
    history: list[dict],
) -> str:
    embeddings = _get_embeddings()
    store = Chroma(
        collection_name=f'rec_{recording_id}',
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH,
    )
    docs = store.similarity_search(question, k=4)
    context = '\n\n'.join(d.page_content for d in docs)

    messages = [
        {
            'role': 'system',
            'content': (
                'You are a helpful assistant answering questions about a meeting transcript. '
                f'Use the following relevant context to answer accurately:\n\n{context}'
            ),
        },
        *[{'role': m['role'], 'content': m['content']} for m in history[-10:]],
        {'role': 'user', 'content': question},
    ]
    llm = get_llm()
    response = llm.invoke(messages)
    return response.content if hasattr(response, 'content') else str(response)


def _get_embeddings():
    # Use a free local embedding model or OpenRouter-compatible endpoint
    # Default: use the LLM API key with text-embedding-3-small if OpenAI
    # For OpenRouter/free: use local sentence-transformers instead
    from langchain_community.embeddings import SentenceTransformerEmbeddings
    return SentenceTransformerEmbeddings(model_name='all-MiniLM-L6-v2')
```

---

## 8. FastAPI App & Routers

### 8.1 App Factory

```python
# src/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import get_settings
from src.api import auth, recordings, jobs, transcripts, speakers, templates, chat, output
from src.db.session import engine
from src.models.base import Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: tables already managed by Alembic, nothing to create here
    yield
    # Shutdown: close connections
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        lifespan=lifespan,
        docs_url='/docs' if settings.DEBUG else None,  # Disable docs in production
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    app.include_router(auth.router, prefix='/auth', tags=['auth'])
    app.include_router(recordings.router, prefix='/recordings', tags=['recordings'])
    app.include_router(jobs.router, prefix='/jobs', tags=['jobs'])
    app.include_router(transcripts.router, prefix='/recordings', tags=['transcripts'])
    app.include_router(speakers.router, prefix='/recordings', tags=['speakers'])
    app.include_router(templates.router, prefix='/templates', tags=['templates'])
    app.include_router(chat.router, prefix='/recordings', tags=['chat'])
    app.include_router(output.router, prefix='/recordings', tags=['output'])

    return app


app = create_app()
```

### 8.2 Dependencies

```python
# src/api/deps.py
from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.models.user import User
from src.utils.security import decode_access_token

bearer = HTTPBearer()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

    user_id = payload.get('sub')
    user = await db.get(User, UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User inactive or not found')
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
```

### 8.3 Recordings Router

```python
# src/api/recordings.py
import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse
from src.api.deps import CurrentUser, DB
from src.models.recording import Recording
from src.models.job import Job
from src.models.template import Template
from src.tasks.pipeline import process_recording
from src.config import get_settings
from sqlalchemy import select

router = APIRouter()
settings = get_settings()
MAX_BYTES = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024


@router.post('', status_code=status.HTTP_202_ACCEPTED)
async def create_recording(
    db: DB,
    current_user: CurrentUser,
    name: str = Form(...),
    language: str = Form('en'),
    template_id: str | None = Form(None),
    mic_audio: UploadFile = File(...),
    system_audio: UploadFile | None = File(None),
):
    recording_id = uuid.uuid4()
    storage_dir = Path(settings.AUDIO_STORAGE_PATH) / str(recording_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    mic_path = str(storage_dir / 'mic.webm')
    system_path = None

    # Save mic audio (chunked to avoid loading entire file into memory)
    async with aiofiles.open(mic_path, 'wb') as f:
        total = 0
        async for chunk in mic_audio:
            total += len(chunk)
            if total > MAX_BYTES:
                raise HTTPException(status_code=413, detail='File too large')
            await f.write(chunk)

    if system_audio:
        system_path = str(storage_dir / 'system.webm')
        async with aiofiles.open(system_path, 'wb') as f:
            async for chunk in system_audio:
                await f.write(chunk)

    # Validate template
    tmpl = None
    if template_id:
        tmpl = await db.get(Template, uuid.UUID(template_id))
        if not tmpl:
            raise HTTPException(status_code=404, detail='Template not found')

    # Create DB records
    recording = Recording(
        id=recording_id,
        user_id=current_user.id,
        name=name,
        language=language,
        mic_audio_path=mic_path,
        system_audio_path=system_path,
    )
    db.add(recording)

    job = Job(
        recording_id=recording_id,
        template_id=tmpl.id if tmpl else None,
        stage='queued',
        progress=0,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue Celery task
    process_recording.delay(str(job.id))

    return {'recording_id': str(recording_id), 'job_id': str(job.id)}


@router.get('')
async def list_recordings(db: DB, current_user: CurrentUser, page: int = 1, per_page: int = 20):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Recording)
        .where(Recording.user_id == current_user.id)
        .order_by(Recording.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    recordings = result.scalars().all()
    return recordings


@router.get('/{recording_id}')
async def get_recording(recording_id: uuid.UUID, db: DB, current_user: CurrentUser):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail='Not found')

    # Get active job (most recent non-done job)
    result = await db.execute(
        select(Job)
        .where(Job.recording_id == recording_id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    latest_job = result.scalar_one_or_none()

    return {
        'id': str(recording.id),
        'name': recording.name,
        'language': recording.language,
        'duration_seconds': recording.duration_seconds,
        'created_at': recording.created_at.isoformat(),
        'active_job_id': str(latest_job.id) if latest_job and latest_job.stage != 'done' else None,
    }


@router.delete('/{recording_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(recording_id: uuid.UUID, db: DB, current_user: CurrentUser):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail='Not found')
    await db.delete(recording)
    await db.commit()
```

### 8.4 Jobs Router

```python
# src/api/jobs.py
import uuid
from fastapi import APIRouter, HTTPException
from src.api.deps import CurrentUser, DB
from src.models.job import Job

router = APIRouter()


@router.get('/{job_id}/status')
async def get_job_status(job_id: uuid.UUID, db: DB, current_user: CurrentUser):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    # Verify ownership via recording
    if job.recording.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Forbidden')
    return {
        'job_id': str(job.id),
        'stage': job.stage,
        'progress': job.progress,
        'error': job.error_message,
        'recording_id': str(job.recording_id),
    }
```

---

## 9. File Upload — Large Audio Handling

For files > 500MB, use chunked upload with a resumable protocol:

1. `POST /recordings/upload/init` → returns `upload_id`
2. `PUT /recordings/upload/{upload_id}/chunk?offset=N` → upload chunk
3. `POST /recordings/upload/{upload_id}/complete` → finalize, start job

This allows the frontend to resume failed uploads. For most recordings (< 200MB) the simple multipart upload in section 8.3 is sufficient. Implement resumable uploads only when needed.

---

## 10. Built-in Templates (Seed Data)

Seed these via an Alembic data migration on first deploy:

```python
BUILTIN_TEMPLATES = [
    {
        'name': 'Meeting Minutes',
        'icon': '📋',
        'category': 'Meeting',
        'system_prompt': (
            'Generate structured meeting minutes from this transcript. '
            'Include: date/participants (if mentioned), agenda items, key discussion points, '
            'decisions made, and action items with owners and due dates. '
            'Format as clean markdown with headers.'
        ),
        'is_builtin': True,
    },
    {
        'name': 'Summary',
        'icon': '📝',
        'category': 'General',
        'system_prompt': (
            'Write a concise executive summary of this conversation. '
            'Cover: main topics discussed, key outcomes, and any open questions. '
            'Target length: 3–5 paragraphs.'
        ),
        'is_builtin': True,
    },
    {
        'name': 'Action Items',
        'icon': '✅',
        'category': 'Meeting',
        'system_prompt': (
            'Extract all action items from this transcript. '
            'For each item include: task description, owner (if mentioned), deadline (if mentioned). '
            'Format as a checklist in markdown.'
        ),
        'is_builtin': True,
    },
    {
        'name': 'Email Draft',
        'icon': '📧',
        'category': 'Communication',
        'system_prompt': (
            'Write a professional follow-up email summarizing this meeting. '
            'Include: brief recap, decisions made, action items, and next steps. '
            'Use a friendly but professional tone.'
        ),
        'is_builtin': True,
    },
]
```

---

## 11. Security

- **Authentication:** JWT Bearer tokens. Access token: 60 min expiry. Refresh token: 30 days.
- **Password hashing:** bcrypt with salt rounds ≥ 12.
- **Input validation:** All request bodies validated via Pydantic v2 models. No raw dict access.
- **SQL injection:** Impossible via SQLAlchemy ORM. No raw SQL queries.
- **File upload safety:** Validate MIME type + extension. Store outside web root. No executable files.
- **Path traversal:** Compute storage paths from UUID only, never from user-supplied filenames.
- **CORS:** Restrict `allow_origins` to the specific Electron app origin in production.
- **Rate limiting:** Add `slowapi` middleware on auth endpoints (login: 10 req/min, register: 5 req/min).
- **Secrets:** Never log API keys or passwords. Use environment variables only.
- **Job ownership:** Always verify `job.recording.user_id == current_user.id` before returning job data.

---

## 12. Database Session

```python
# src/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import Session, sessionmaker
from src.config import get_settings

settings = get_settings()

# Async engine for FastAPI
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# Sync engine for Celery (Celery tasks are sync)
sync_engine = create_async_engine(
    settings.DATABASE_URL.replace('postgresql+asyncpg', 'postgresql+psycopg2'),
    pool_size=5,
)

SyncSessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
```

---

## 13. Deployment

### Docker Compose

```yaml
# docker-compose.yml
services:
  api:
    build: ./backend
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 2
    environment:
      - DATABASE_URL=postgresql+asyncpg://quillvault:secret@db/quillvault
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    volumes:
      - audio_data:/data/audio
      - chroma_data:/data/chroma
    depends_on: [db, redis]
    ports:
      - '8000:8000'

  worker:
    build: ./backend
    command: celery -A src.celery_app worker --loglevel=info --concurrency=1
    # concurrency=1: one task at a time — ML models are already parallelized internally
    environment:
      - DATABASE_URL=postgresql+psycopg2://quillvault:secret@db/quillvault
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - audio_data:/data/audio
      - chroma_data:/data/chroma
      - model_cache:/root/.cache  # HuggingFace + faster-whisper model cache
    depends_on: [db, redis]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]  # Remove if CPU-only

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quillvault
      POSTGRES_USER: quillvault
      POSTGRES_PASSWORD: secret
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  redis_data:
  audio_data:
  chroma_data:
  model_cache:
```

### Run Migrations

```bash
alembic upgrade head
```

### Worker Startup (with model pre-warm)

Add a startup task that pre-loads all ML models on worker init:

```python
# src/tasks/pipeline.py
from celery.signals import worker_ready

@worker_ready.connect
def on_worker_ready(**kwargs):
    """Pre-load all ML models when worker starts."""
    from src.services.transcription_service import _get_model
    from src.services.diarization_service import _get_diarization_pipeline
    _get_model()
    _get_diarization_pipeline()
    logging.info('ML models pre-loaded and ready')
```

---

## 14. Model Recommendations

### Transcription: `faster-whisper`
- Recommended model: `large-v3` (best accuracy, ~3GB VRAM / can run on CPU)
- Fast CPU option: `medium` or `base.en` (English only, ~150MB)
- CTranslate2 backend: 4× faster than original Whisper

### Diarization: `pyannote/speaker-diarization-3.1`
- Best open-source diarization model
- Requires HuggingFace token (free account + model access request)
- Alternative: `nvidia/nemo` toolkit (no token required)

### LLM: OpenRouter free tier
- `meta-llama/llama-3.1-8b-instruct:free` — best free option for text tasks
- `google/gemma-2-9b-it:free` — good alternative
- Local alternative: Ollama with `llama3.1:8b` (no API key, runs on machine)

### Embeddings (RAG): `sentence-transformers/all-MiniLM-L6-v2`
- 80MB, runs locally, no API key required
- Adequate quality for document chat

---

## 15. Best Practices

- **Celery tasks are idempotent:** Can be safely retried. Check if transcript already exists before saving.
- **Never store raw audio paths from user input.** Always compute paths from UUID.
- **Model loading is expensive.** Load once at startup via `lru_cache`, reuse across tasks.
- **Async FastAPI + sync Celery.** Use separate sync SQLAlchemy engine for Celery tasks.
- **Log every pipeline stage start/end** with recording_id and duration for debugging.
- **Graceful degradation:** If speaker naming LLM call fails, save diarized labels as-is. Never fail the whole pipeline for a non-critical step.
- **Audio files are cleaned up** after a configurable retention period (e.g., 30 days), keeping only transcripts in DB.
- **Use Alembic for all schema changes.** Never use `Base.metadata.create_all()` in production.
- **Health endpoint:** `GET /health` returns `{"status": "ok", "db": "ok", "redis": "ok"}` — used by Docker health checks.
