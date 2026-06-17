# QuillVault — Docker Setup

## Quick Start

### 1. Create your `.env` file

```bash
cp .env.docker .env
# Edit .env with your actual values (JWT_SECRET, HUGGINGFACE_TOKEN, LLM_API_KEY, etc.)
```

### 2. Run in CPU mode (default)

```bash
docker compose up --build
```

### 3. Run in GPU mode (for your 1080ti server)

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

That's it! The GPU override file sets `WHISPER_DEVICE=cuda` and reserves the NVIDIA GPU.

---

## Building & Pushing to Docker Hub

You only need **one image** — GPU/CPU switching happens at runtime via environment variables.

### Build locally
```bash
# From the repo root:
docker build -t quillvault-backend ./backend
```

### Push to Docker Hub
```bash
# 1. Log in
docker login

# 2. Tag with your Docker Hub username
export DOCKER_USER=yourusername
docker tag quillvault-backend ${DOCKER_USER}/quillvault-backend:latest
docker tag quillvault-backend ${DOCKER_USER}/quillvault-backend:$(date +%Y%m%d)

# 3. Push
docker push ${DOCKER_USER}/quillvault-backend:latest
docker push ${DOCKER_USER}/quillvault-backend:$(date +%Y%m%d)
```

Or use the provided script:
```bash
export DOCKER_USER=yourusername
chmod +x docker-build.sh
./docker-build.sh push        # build + push
./docker-build.sh              # build only
```

### Pull & run on another machine (e.g. your GPU server)
```bash
# Copy .env to the server, then:
docker compose -f docker-compose.yml -f docker-compose.hub.yml up

# Or with GPU:
docker compose -f docker-compose.yml -f docker-compose.hub.yml -f docker-compose.gpu.yml up
```

The `docker-compose.hub.yml` override swaps `build:` for `image:` so it pulls from Docker Hub instead of building locally.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  backend-api  │  │ celery-worker│  │  postgres    │  │
│  │  (FastAPI)    │  │  (ML tasks)  │  │  (database)  │  │
│  │  :8000        │  │  [GPU/CPU]   │  │  :5432       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                              │
│         └────────┬────────┘                              │
│                  │                                       │
│           ┌──────┴───────┐                               │
│           │    redis      │                               │
│           │    :6379      │                               │
│           └──────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

- **backend-api** — FastAPI HTTP server (port 8000)
- **celery-worker** — Processes ML tasks (whisper, pyannote). This is where GPU matters.
- **postgres** — PostgreSQL database
- **redis** — Celery broker + result backend

---

## GPU vs CPU Switching

### CPU mode (development on your local machine)
```bash
docker compose up --build
```
Uses `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=float32`. Slower but works everywhere.

### GPU mode (on your 1080ti server)
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```
Uses `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`. The 1080ti has 11 GB VRAM which is enough for:
- `large-v3` whisper model (~3 GB)
- `pyannote/speaker-diarization-3.1` (~1 GB)
- Plenty of headroom for audio processing

### Prerequisites for GPU mode
1. **NVIDIA driver** installed on the host
2. **nvidia-container-toolkit** installed:
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```
3. Verify: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`

---

## Useful Commands

```bash
# Start all services (CPU)
docker compose up -d

# Start all services (GPU)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# View logs
docker compose logs -f celery-worker
docker compose logs -f backend-api

# Rebuild after code changes
docker compose up --build

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: deletes database + cached models)
docker compose down -v

# Run migrations manually
docker compose exec backend-api python3 -m alembic upgrade head

# Open a shell in the backend container
docker compose exec backend-api bash

# Check GPU is visible inside container
docker compose exec celery-worker python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

---

## Model Caching

Models are cached in a Docker volume (`hf_cache`) mapped to `/app/.cache/huggingface` inside the container. This means:
- Models are downloaded only once (on first run)
- They persist across `docker compose down` / `up` cycles
- To clear the cache: `docker compose down -v` (removes all volumes) or `docker volume rm quillvault_hf_cache`

---

## Volume Mounts

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | Database files |
| `redis_data` | `/data` | Redis persistence |
| `audio_data` | `/app/data/audio` | Uploaded audio files |
| `hf_cache` | `/app/.cache/huggingface` | Downloaded ML models |
| `backend_logs` | `/app/logs` | Application logs |

---

## Environment Variables Reference

See `.env.docker` for a complete template with all variables and descriptions.

Key model-related variables:

| Variable | CPU Value | GPU Value (1080ti) | Description |
|----------|-----------|-------------------|-------------|
| `WHISPER_MODEL` | `large-v3` | `large-v3` | Whisper model size |
| `WHISPER_DEVICE` | `cpu` | `cuda` | Compute device |
| `WHISPER_COMPUTE_TYPE` | `float32` | `float16` | Precision type |
| `HUGGINGFACE_TOKEN` | — | — | Required for pyannote models |

---

## Troubleshooting

### "CUDA not available" in GPU mode
- Verify NVIDIA driver: `nvidia-smi` on host
- Verify container toolkit: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
- Check docker-compose.gpu.yml is being used: `docker compose config | grep -A5 deploy`

### Out of VRAM
- Use a smaller model: `WHISPER_MODEL=medium` or `WHISPER_MODEL=base`
- Use int8 quantization: `WHISPER_COMPUTE_TYPE=int8`
- The 1080ti (11 GB) should handle `large-v3` + diarization without issues

### Slow first run
The first `docker compose up` downloads:
1. CUDA base image (~1.5 GB)
2. PyTorch with CUDA (~2.5 GB)
3. Python dependencies (~1 GB)
4. ML models on first transcription task (~3-5 GB)

Subsequent runs are fast thanks to Docker layer caching and the `hf_cache` volume.

### Container exits immediately
Check logs: `docker compose logs backend-api` or `docker compose logs celery-worker`
