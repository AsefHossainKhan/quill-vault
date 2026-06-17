# QuillVault Backend - GPU/CPU Docker Image
# Uses CUDA 11.8 base so the SAME image works for both GPU and CPU.
# Device selection is done at runtime via WHISPER_DEVICE env var.
#
# Build:   docker build -t quillvault-backend ./backend
# GPU run: docker run --gpus all -e WHISPER_DEVICE=cuda -e WHISPER_COMPUTE_TYPE=float16 ...
# CPU run: docker run -e WHISPER_DEVICE=cpu -e WHISPER_COMPUTE_TYPE=float32 ...

FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# ── Prevent interactive prompts ──────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive

# ── System dependencies ──────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    curl \
    git \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python  python  /usr/bin/python3.11 1 \
    && rm -rf /var/lib/apt/lists/*

# ── Python setup ─────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python3 -m pip install --upgrade pip setuptools wheel

# ── PyTorch with CUDA 11.8 support ──────────────────────────
# Separate layer — this is ~2.5 GB and rarely changes.
RUN python3 -m pip install \
    torch==2.4.0+cu118 \
    torchaudio==2.4.0+cu118 \
    --index-url https://download.pytorch.org/whl/cu118

# ── Copy application source ─────────────────────────────────
WORKDIR /app
COPY . /app

# ── Install project dependencies from pyproject.toml ─────────
# pip sees torch==2.4.0+cu118 as satisfying torch>=2.0.0,
# so it will NOT overwrite our CUDA torch with the CPU version.
RUN python3 -m pip install .

# ── Data directories ────────────────────────────────────────
RUN mkdir -p /app/data/audio /app/data/test-audio /app/logs

# ── HuggingFace model cache (mount as volume for persistence) ──
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p /app/.cache/huggingface

# ── Health check ─────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]