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
# Using 2.3.1 — the latest version that supports compute capability 6.1 (Pascal / 1080 Ti).
# PyTorch 2.4+ dropped CC < 7.5.
RUN python3 -m pip install \
    torch==2.3.1+cu118 \
    torchaudio==2.3.1+cu118 \
    --index-url https://download.pytorch.org/whl/cu118

# ── CUDA 12 cublas for ctranslate2 (faster-whisper engine) ──
# ctranslate2 is compiled against CUDA 12 but our base image is CUDA 11.8.
# Install ONLY libcublas.so.12 (NOT the pip nvidia packages, which bring
# in CUDA 12 cuDNN that conflicts with our CUDA 11.8 cuDNN).
# The NVIDIA repo is already configured in the CUDA 11.8 base image.
RUN apt-get update && apt-get install -y --no-install-recommends libcublas-12-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install Python dependencies ─────────────────────────────
# Copy pyproject.toml + constraints FIRST for layer caching.
# The constraints file pins torch==2.3.1 so pip does NOT upgrade
# it when resolving torch>=2.0.0 from pyproject.toml.
COPY pyproject.toml constraints-torch.txt ./
RUN mkdir -p src && touch src/__init__.py && \
    python3 -m pip install -e . -c constraints-torch.txt

# ── Copy application source (LAST — most frequently changed) ──
# Code edits only invalidate THIS layer and what's below.
# All expensive layers above are cached.
COPY . /app

# ── Re-link package with actual source ───────────────────────
RUN python3 -m pip install -e . --no-deps

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
