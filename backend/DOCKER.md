# QuillVault — Docker Deployment Guide

## Table of Contents
- [Quick Start](#quick-start)
- [Build & Push (Dev Machine)](#build--push-dev-machine)
- [Deploy on Server](#deploy-on-server)
- [GPU Configuration](#gpu-configuration)
- [Environment Variables](#environment-variables)
- [Seeding Database](#seeding-database)
- [Common Commands](#common-commands)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Dev machine (build + push)

`powershell
# From repo root — set your Docker Hub username
$env:DOCKER_USER = "yourusername"

# Build (Dockerfile is in backend/)
docker build -t "$env:DOCKER_USER/quillvault-backend:latest" ./backend

# Push
docker login
docker push "$env:DOCKER_USER/quillvault-backend:latest"
`

### Server (pull + run)

`bash
# Copy files to server
scp backend/docker-compose.server.yml user@server:~/quillvault/docker-compose.yml
scp backend/.env.docker user@server:~/quillvault/.env.docker

# SSH in and configure
ssh user@server
cd ~/quillvault
cp .env.docker .env
nano .env   # Set DOCKER_USER, JWT_SECRET, HUGGINGFACE_TOKEN, LLM_API_KEY

# Run
docker compose up -d
`

---

## Build & Push (Dev Machine)

### Docker files layout

All Docker files live inside `backend/`:

`
backend/
├── Dockerfile                 # Image definition
├── docker-entrypoint.sh       # Container startup (migrations, seeding, service launch)
├── constraints-torch.txt      # Pins PyTorch to 2.3.1 for 1080 Ti compat
├── .dockerignore              # Keeps build context lean
├── docker-compose.yml         # Local dev (builds from source, CPU default)
├── docker-compose.server.yml  # Production (pulls from Docker Hub)
├── docker-compose.gpu.yml     # GPU override for local dev
├── .env.docker                # Complete env var template
├── DOCKER.md                  # This file
├── docker-build.sh            # Build & push helper script
└── deploy/                    # GPU presets
    ├── env.nvidia-1080ti
    ├── env.nvidia-3060ti
    ├── env.cpu-only
    └── env.cpu-fast
`

### Build commands

`powershell
# From repo root:
# Full rebuild (first time or after dependency changes)
docker build --no-cache -t "$env:DOCKER_USER/quillvault-backend:latest" ./backend

# Incremental build (code changes only — fast, ~10 seconds)
docker build -t "$env:DOCKER_USER/quillvault-backend:latest" ./backend

# Tag with date for versioning
docker tag "$env:DOCKER_USER/quillvault-backend:latest" "$env:DOCKER_USER/quillvault-backend:20260619"
`

### Push commands

`powershell
docker login
docker push "$env:DOCKER_USER/quillvault-backend:latest"
docker push "$env:DOCKER_USER/quillvault-backend:20260619"
`

### Docker layer caching

The Dockerfile is optimized so that code changes only rebuild the last 2 layers (seconds):
`
1. CUDA base image          ← cached permanently
2. System deps (apt)        ← cached permanently
3. Python + pip             ← cached permanently
4. PyTorch 2.3.1+cu118      ← cached permanently (~30 min first time)
5. libcublas-12-0           ← cached permanently
6. COPY pyproject.toml      ← only invalidates when deps change
7. pip install deps         ← cached with pyproject.toml
8. PyTorch override         ← cached with deps
9. COPY . /app              ← invalidates on code change (fast)
10. pip install --no-deps   ← re-links source (seconds)
`

### Cleaning up disk space

`powershell
docker system df              # See what's using space
docker system prune -a -f     # Remove unused images/cache
docker system prune -a --volumes -f  # Nuclear (deletes DB + model cache)
`

---

## Deploy on Server

### Files to copy to server

Only 2 files are needed on the server:
- `backend/docker-compose.server.yml` → rename to `docker-compose.yml`
- `backend/.env.docker` → copy as template, then create `.env` from it

### Step-by-step

`bash
# 1. Create directory on server
ssh user@server "mkdir -p ~/quillvault"

# 2. Copy files
scp backend/docker-compose.server.yml user@server:~/quillvault/docker-compose.yml
scp backend/.env.docker user@server:~/quillvault/.env.docker

# 3. SSH in
ssh user@server
cd ~/quillvault

# 4. Create .env from template
cp .env.docker .env

# 5. Edit .env — REQUIRED values:
#    DOCKER_USER=yourusername
#    JWT_SECRET=$(openssl rand -hex 32)
#    HUGGINGFACE_TOKEN=hf_xxxxx
#    LLM_API_KEY=sk-or-xxxxx

# 6. Choose GPU preset (see GPU Configuration below)
#    For 1080 Ti:  WHISPER_DEVICE=cuda, WHISPER_COMPUTE_TYPE=int8
#    For 3060 Ti:  WHISPER_DEVICE=cuda, WHISPER_COMPUTE_TYPE=float16
#    For CPU only: WHISPER_DEVICE=cpu,  WHISPER_COMPUTE_TYPE=float32

# 7. For GPU: uncomment the deploy block in docker-compose.yml

# 8. Run
docker compose up -d

# 9. Verify
docker compose ps
docker compose logs -f celery-worker
`

### Updating to a new version

`bash
# On dev machine: build + push
docker build -t "$env:DOCKER_USER/quillvault-backend:latest" ./backend
docker push "$env:DOCKER_USER/quillvault-backend:latest"

# On server: pull + restart
sudo docker compose pull
sudo docker compose down
sudo docker compose up -d
`

---

## GPU Configuration

### Supported GPUs

| GPU | VRAM | Compute | WHISPER_DEVICE | WHISPER_COMPUTE_TYPE | Notes |
|-----|------|---------|----------------|---------------------|-------|
| GTX 1080 Ti | 11 GB | 6.1 (Pascal) | `cuda` | `int8` | float16 NOT supported |
| RTX 2060/2070/2080 | 6-11 GB | 7.5 (Turing) | `cuda` | `float16` | |
| RTX 3060 Ti | 8 GB | 8.6 (Ampere) | `cuda` | `float16` | |
| RTX 3070/3080/3090 | 8-24 GB | 8.6 (Ampere) | `cuda` | `float16` | |
| RTX 4060/4070/4080/4090 | 8-24 GB | 8.9 (Ada) | `cuda` | `float16` | |
| CPU only | N/A | N/A | `cpu` | `float32` | Use `base` model for speed |

### VRAM usage (large-v3 model)

| Compute Type | VRAM Usage | Quality |
|-------------|------------|---------|
| `float16` | ~3 GB | Best (Ampere+) |
| `int8` | ~2 GB | Good (all GPUs) |
| `float32` | ~5 GB | Best (CPU) |

### GPU setup on server

`bash
# Install NVIDIA Container Toolkit (Ubuntu/Debian)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify GPU is accessible
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
`

### Enabling GPU in docker-compose.yml

In your server `docker-compose.yml`, uncomment the deploy block under `celery-worker`:
`yaml
celery-worker:
    # ... other config ...
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
`

### Switching between CPU and GPU

Just edit `.env`:
`bash
# Switch to GPU
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=int8    # or float16 for Ampere+

# Switch to CPU
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=float32
`

Then:
`bash
sudo docker compose down
sudo docker compose up -d
`

**Important**: `docker compose restart` does NOT re-read .env. You must use `down` + `up -d`.

---

## Environment Variables

### Required (must set in .env)

| Variable | Description | Example |
|----------|-------------|---------|
| `DOCKER_USER` | Docker Hub username | `myuser` |
| `JWT_SECRET` | Auth token secret (min 32 chars) | `$(openssl rand -hex 32)` |
| `HUGGINGFACE_TOKEN` | HF token for pyannote models | `hf_xxxxx` |
| `DATABASE_URL` | PostgreSQL connection string | (see .env.docker) |

### Optional (have sensible defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `large-v3` | Whisper model size (`tiny`, `base`, `small`, `medium`, `large-v3`) |
| `WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | `float32` | `float32`, `float16`, or `int8` |
| `LLM_API_KEY` | (empty) | OpenRouter API key |
| `LLM_MODEL` | `openrouter/free` | LLM model identifier |
| `SEED_DB` | `true` | Seed templates + test users on startup |
| `RUN_MIGRATIONS` | `true` | Run Alembic migrations on startup |
| `API_PORT` | `8000` | FastAPI server port |
| `CELERY_CONCURRENCY` | `1` | Worker concurrency (keep at 1 for ML tasks) |

### GPU presets

Preset files are in `backend/deploy/`. Copy the relevant lines into your `.env`:

| File | GPU |
|------|-----|
| `deploy/env.nvidia-1080ti` | GTX 1080 Ti |
| `deploy/env.nvidia-3060ti` | RTX 3060 Ti |
| `deploy/env.cpu-only` | CPU (accurate) |
| `deploy/env.cpu-fast` | CPU (fast) |

---

## Seeding Database

The database is automatically seeded on first startup (templates + test users).

### What gets seeded

**Templates** (4 built-in):
- 📋 Meeting Minutes
- 📝 Summary
- ✅ Action Items
- 📧 Email Draft

**Test users** (3):
| Email | Password | Name |
|-------|----------|------|
| `user1@u.com` | `123qwe` | User One |
| `user2@u.com` | `123qwe` | User Two |
| `user3@u.com` | `123qwe` | User Three |

### Controlling seeding

`bash
# In .env:
SEED_DB=true     # Seed on startup (default)
SEED_DB=false    # Skip seeding
`

### Manual seeding

`bash
# Inside the container
docker compose exec backend-api python3 -m src.seed

# Or via SSH on server
sudo docker compose exec backend-api python3 -m src.seed
`

### Why templates weren't there before

The `src/seed.py` script was never called during container startup. It's now integrated into the entrypoint — on every `docker compose up`, the container checks if templates exist and seeds them if needed (idempotent — safe to run multiple times).

---

## Common Commands

### Lifecycle

`bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart (does NOT re-read .env)
docker compose restart

# Recreate with new .env (required after .env changes)
docker compose down && docker compose up -d

# View running containers
docker compose ps
`

### Logs

`bash
# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f celery-worker
docker compose logs -f backend-api

# Last 100 lines
docker compose logs --tail 100 celery-worker
`

### Debugging

`bash
# Shell into container
docker compose exec backend-api bash

# Check PyTorch version + GPU
docker compose exec celery-worker python3 -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"

# Check GPU on host
nvidia-smi

# Monitor GPU in real-time
watch -n 1 nvidia-smi
`

### Database

`bash
# Run migrations manually
docker compose exec backend-api python3 -m alembic upgrade head

# Seed database manually
docker compose exec backend-api python3 -m src.seed

# Connect to database
docker compose exec postgres psql -U postgres -d quillvault
`

### Volumes

`bash
# List volumes
docker volume ls | grep quillvault

# Clear model cache (re-downloads on next task)
docker volume rm quillvault_hf_cache

# Nuclear: delete everything (DB, models, audio)
docker compose down -v
`

---

## Architecture

`
+-----------------------------------------------------------+
|                    Docker Host                            |
|                                                           |
|  +--------------+  +---------------+  +--------------+    |
|  |  backend-api  |  | celery-worker |  |  postgres    |    |
|  |  (FastAPI)    |  |  (ML tasks)   |  |  (database)  |    |
|  |  :8000        |  |  [GPU/CPU]    |  |  :5432       |    |
|  +------+-------+  +-------+-------+  +--------------+    |
|         |                  |                               |
|         +---------+--------+                               |
|                   |                                        |
|            +------+-------+                                |
|            |    redis      |                                |
|            |    :6379      |                                |
|            +--------------+                                |
|                                                            |
|  Volumes:                                                  |
|    postgres_data  -> /var/lib/postgresql/data               |
|    redis_data     -> /data                                  |
|    audio_data     -> /app/data/audio                        |
|    hf_cache       -> /app/.cache/huggingface                |
|    backend_logs   -> /app/logs                              |
+-----------------------------------------------------------+
`

- **backend-api** — FastAPI HTTP server. Handles requests, queues ML jobs to Celery.
- **celery-worker** — Runs ML tasks (whisper transcription, pyannote diarization).
- **postgres** — PostgreSQL database.
- **redis** — Celery broker + result backend.

Only the **celery-worker** needs GPU. The API server always runs on CPU.

---

## Troubleshooting

### "CUDA not available"
- Run `nvidia-smi` on host — verify driver is installed
- Verify nvidia-container-toolkit: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
- Make sure the `deploy` block is uncommented in docker-compose.yml

### "float16 compute type not supported"
- Your GPU doesn't support float16 for ctranslate2 (Pascal GPUs like 1080 Ti)
- Use `int8` instead: `WHISPER_COMPUTE_TYPE=int8`

### "cuDNN STATUS_VERSION_MISMATCH"
- Should not happen with current setup (diarization forced to CPU)
- If it does, ensure you didn't install nvidia pip packages that bring CUDA 12 cuDNN

### Container exits immediately
`bash
docker compose logs backend-api
docker compose logs celery-worker
`

### Slow first run
First startup downloads ML models (~3-5 GB). Subsequent runs use cached models in the `hf_cache` volume.

### .env changes not taking effect
`bash
# restart does NOT re-read .env
docker compose restart        # ❌ old env vars

# down + up DOES re-read .env
docker compose down           # ✅
docker compose up -d          # ✅ new env vars
`

### Out of VRAM
- Use a smaller model: `WHISPER_MODEL=medium` or `WHISPER_MODEL=base`
- Use int8: `WHISPER_COMPUTE_TYPE=int8`

### Disk space running low
`bash
docker system df              # Check usage
docker system prune -a -f     # Remove unused images/cache
`
