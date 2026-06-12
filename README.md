# QuillVault

An Electron + React desktop app with a FastAPI backend for audio transcription, speaker diarization, and AI-powered meeting notes.

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Electron · React 18 · TypeScript · Vite · Tailwind CSS · Zustand |
| **Backend** | Python 3.11+ · FastAPI · SQLAlchemy (async) · PostgreSQL · Redis · Celery |
| **ML** | faster-whisper · pyannote.audio · WhisperX · HuggingFace Transformers (ONNX) |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | 22+ | Includes npm |
| [Python](https://www.python.org/) | 3.11+ | With `pip` |
| [Git LFS](https://git-lfs.com/) | 3.x | Tracks the ONNX model files (~146 MB) |
| [PostgreSQL](https://www.postgresql.org/) | 14+ | Database |
| [Redis](https://redis.io/) | 7+ | Celery broker |

---

## Git LFS Setup

The Whisper ONNX models (`frontend/public/models/whisper-tiny/onnx/`) are ~146 MB — too large for regular Git. They are tracked via **Git LFS**.

### If you already cloned the repo

```bash
# Make sure LFS is installed
git lfs install

# Pull the actual model files (not just pointers)
git lfs pull
```

### Migrating large files to LFS (reference)

These are the commands used to move the `.onnx` files from regular Git tracking into LFS:

```bash
# 1. Install Git LFS and initialize it in the repo
git lfs install

# 2. Tell LFS which file patterns to track
git lfs track "*.onnx"

# 3. Remove the files from Git's index (keeps them on disk)
git rm --cached frontend/public/models/whisper-tiny/onnx/decoder_model_merged.onnx
git rm --cached frontend/public/models/whisper-tiny/onnx/encoder_model.onnx

# 4. Re-add them — .gitattributes now routes them through LFS
git add .gitattributes \
        frontend/public/models/whisper-tiny/onnx/decoder_model_merged.onnx \
        frontend/public/models/whisper-tiny/onnx/encoder_model.onnx

# 5. Commit
git commit -m "chore: migrate ONNX models to Git LFS"
```

After this, `git lfs status` shows the files as LFS objects, and the `.gitattributes` file ensures anyone who clones gets them automatically.

---

## Project Structure

```
quill-vault/
├── backend/                  # FastAPI + Celery backend
│   ├── alembic/              # Database migrations
│   ├── src/
│   │   ├── api/              # Route handlers
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   ├── tasks/            # Celery tasks
│   │   └── config.py         # Settings (pydantic-settings)
│   ├── data/                 # Audio storage (git-ignored)
│   ├── pyproject.toml
│   ├── manage.py             # Service management script
│   └── .env.example
├── frontend/                 # Electron + React + Vite
│   ├── electron/             # Electron main/preload
│   ├── src/                  # React app
│   ├── public/models/        # Whisper ONNX models (LFS)
│   ├── package.json
│   └── .env.example
└── reference/                # Design specs & guides
```

---

## Backend Setup

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 2. Install dependencies
pip install -e ".[dev]"

# 3. Copy the example env file and fill in your values
cp .env.example .env

# 4. Create the PostgreSQL database
createdb quillvault

# 5. Run database migrations
alembic upgrade head

# 6. Start the API server + Celery worker
python manage.py start
# Or start them individually:
#   uvicorn src.main:app --reload --port 8000
#   celery -A src.celery_app worker --pool=solo --loglevel=info
```

The API runs at **http://localhost:8000**. Swagger docs are available at `/docs` when `DEBUG=true`.

### Backend .env reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/quillvault` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `JWT_SECRET` | Secret for JWT signing | — (required) |
| `WHISPER_MODEL` | Whisper model size | `large-v3` |
| `LLM_API_KEY` | API key for LLM provider (OpenRouter) | — |

---

## Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy the example env file
cp .env.example .env

# 3. Start the dev server (Vite + Electron)
npm run dev
```

This launches the Vite dev server and opens the Electron window with hot reload.

### Frontend .env reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |

---

## Available Scripts

### Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `python manage.py start` | Start API + Celery worker |
| `python manage.py stop` | Stop all services |
| `python manage.py restart` | Restart all services |
| `python manage.py status` | Show service status |
| `python manage.py check` | Run health checks |
| `pytest` | Run tests |
| `ruff check .` | Lint Python code |
| `alembic revision --autogenerate -m "description"` | Create a new migration |

### Frontend (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server + Electron |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

---

## Database Migrations

```bash
cd backend

# Create a new migration after model changes
alembic revision --autogenerate -m "add new table"

# Apply pending migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

---

## Troubleshooting

### Git LFS models not downloading

```bash
git lfs install
git lfs pull
```

### Backend won't start — missing `.env`

Make sure you copied `.env.example` to `.env` and filled in `DATABASE_URL`, `JWT_SECRET`, and any other required values.

### Celery worker errors on Windows

The Celery worker uses `--pool=solo` because Windows doesn't support `fork`. This is handled automatically by `manage.py start`.

### PostgreSQL connection refused

Ensure PostgreSQL is running and the database exists:

```bash
createdb quillvault
# Or check status:
pg_isready
```
