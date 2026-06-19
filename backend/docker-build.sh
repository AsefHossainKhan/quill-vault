#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# QuillVault — Build & Push to Docker Hub
# ─────────────────────────────────────────────────────────────
# Usage:
#   cd backend && ./docker-build.sh                # build only
#   cd backend && ./docker-build.sh push           # build + push
#   cd backend && ./docker-build.sh push --no-cache
#
# Set your Docker Hub username:
#   export DOCKER_USER=yourusername
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
DOCKER_USER="${DOCKER_USER:-yourusername}"
IMAGE_NAME="quillvault-backend"
TAG="${TAG:-latest}"
FULL_IMAGE="${DOCKER_USER}/${IMAGE_NAME}:${TAG}"

ACTION="${1:-build}"
BUILD_ARGS=""

if [ "${2:-}" = "--no-cache" ]; then
    BUILD_ARGS="--no-cache"
fi

echo "╔══════════════════════════════════════════════╗"
echo "║     QuillVault Docker Build & Push           ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Image : ${FULL_IMAGE}"
echo "║  Action: ${ACTION}"
echo "╚══════════════════════════════════════════════╝"

# ── Build ─────────────────────────────────────────────────────
echo ""
echo "🔨 Building image..."
docker build ${BUILD_ARGS} -t "${FULL_IMAGE}" -t "${DOCKER_USER}/${IMAGE_NAME}:$(date +%Y%m%d)" .
echo "✅ Build complete: ${FULL_IMAGE}"

# ── Push ──────────────────────────────────────────────────────
if [ "${ACTION}" = "push" ]; then
    echo ""
    echo "🔐 Checking Docker Hub login..."
    if ! docker info 2>/dev/null | grep -q "Username"; then
        echo "⚠️  Not logged in. Running docker login..."
        docker login
    fi

    echo ""
    echo "📤 Pushing ${FULL_IMAGE}..."
    docker push "${FULL_IMAGE}"

    # Also push the date-tagged version
    DATE_TAG="${DOCKER_USER}/${IMAGE_NAME}:$(date +%Y%m%d)"
    echo "📤 Pushing ${DATE_TAG}..."
    docker push "${DATE_TAG}"

    echo ""
    echo "✅ Done! Images pushed:"
    echo "   - ${FULL_IMAGE}"
    echo "   - ${DATE_TAG}"
    echo ""
    echo "To use on another machine:"
    echo "   docker pull ${FULL_IMAGE}"
fi

echo ""
echo "📋 Local images:"
docker images "${DOCKER_USER}/${IMAGE_NAME}" --format "   {{.Repository}}:{{.Tag}} ({{.Size}})"
