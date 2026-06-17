#!/usr/bin/env bash
set -e

echo "╔══════════════════════════════════════════════╗"
echo "║        QuillVault Backend Container          ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Device    : ${WHISPER_DEVICE:-cpu}            ║"
echo "║  Compute   : ${WHISPER_COMPUTE_TYPE:-float32}  ║"
echo "║  Model     : ${WHISPER_MODEL:-large-v3}        ║"
echo "╚══════════════════════════════════════════════╝"

# ── Detect GPU availability ──────────────────────────────────
if [ "${WHISPER_DEVICE}" = "cuda" ]; then
    if python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
        GPU_NAME=$(python3 -c "import torch; print(torch.cuda.get_device_name(0))")
        GPU_MEM=$(python3 -c "import torch; print(round(torch.cuda.get_device_properties(0).total_mem / 1024**3, 1))")
        echo "✅ GPU detected: ${GPU_NAME} (${GPU_MEM} GB)"
    else
        echo "⚠️  WHISPER_DEVICE=cuda but no GPU found! Falling back to CPU."
        export WHISPER_DEVICE=cpu
        export WHISPER_COMPUTE_TYPE=float32
    fi
fi

# ── Run database migrations ──────────────────────────────────
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "🔄 Running database migrations..."
    python3 -m alembic upgrade head || echo "⚠️  Migrations failed (DB may not be ready yet)"
fi

# ── Determine which service to run ───────────────────────────
SERVICE_TYPE="${SERVICE_TYPE:-all}"

case "${SERVICE_TYPE}" in
    api)
        echo "🚀 Starting FastAPI server..."
        exec python3 -m uvicorn src.main:app \
            --host 0.0.0.0 \
            --port "${API_PORT:-8000}" \
            --workers "${API_WORKERS:-1}" \
            --log-level "${LOG_LEVEL:-info}"
        ;;
    celery)
        echo "🔧 Starting Celery worker..."
        exec python3 -m celery -A src.celery_app worker \
            --loglevel="${LOG_LEVEL:-info}" \
            -E \
            --concurrency="${CELERY_CONCURRENCY:-1}" \
            -P "${CELERY_POOL:-prefork}"
        ;;
    all)
        echo "🚀 Starting FastAPI server + Celery worker..."

        # Cleanup trap: kill background processes on exit
        cleanup() {
            echo "🛑 Shutting down..."
            kill $CELERY_PID 2>/dev/null || true
            wait $CELERY_PID 2>/dev/null || true
            kill $API_PID 2>/dev/null || true
            wait $API_PID 2>/dev/null || true
        }
        trap cleanup SIGTERM SIGINT

        # Start Celery in background
        python3 -m celery -A src.celery_app worker \
            --loglevel="${LOG_LEVEL:-info}" \
            -E \
            --concurrency="${CELERY_CONCURRENCY:-1}" \
            -P "${CELERY_POOL:-prefork}" &
        CELERY_PID=$!

        # Start API in foreground
        python3 -m uvicorn src.main:app \
            --host 0.0.0.0 \
            --port "${API_PORT:-8000}" \
            --workers 1 \
            --log-level "${LOG_LEVEL:-info}" &
        API_PID=$!

        # Wait for either process to exit
        wait -n
        cleanup
        exit 1
        ;;
    *)
        echo "❌ Unknown SERVICE_TYPE: ${SERVICE_TYPE}"
        echo "   Valid options: api, celery, all"
        exit 1
        ;;
esac