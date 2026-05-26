#!/usr/bin/env bash
# =============================================================================
# OpenLDR — Build and push Docker images to Docker Hub
# =============================================================================
# Usage:
#   ./docker/scripts/build-and-push.sh                    # defaults: openldr / latest
#   ./docker/scripts/build-and-push.sh --registry myorg   # custom registry
#   ./docker/scripts/build-and-push.sh --tag v1.0.0       # custom tag
#   ./docker/scripts/build-and-push.sh --dry-run           # print commands only
#
# This script MUST be run from the repository root.
# =============================================================================

set -euo pipefail

REGISTRY="${DOCKER_REGISTRY:-openldr}"
TAG="${IMAGE_TAG:-latest}"
DRY_RUN=false
PUSH=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --registry) REGISTRY="$2"; shift 2 ;;
    --tag)      TAG="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --no-push)  PUSH=false; shift ;;
    -h|--help)
      echo "Usage: $0 [--registry <org>] [--tag <tag>] [--dry-run] [--no-push]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Verify we're at the repo root
if [[ ! -f "package.json" ]] || [[ ! -d "apps" ]]; then
  echo "ERROR: This script must be run from the repository root."
  echo "  cd /path/to/openldr-v2 && ./docker/scripts/build-and-push.sh"
  exit 1
fi

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

echo "============================================="
echo " OpenLDR Docker Build & Push"
echo " Registry: ${REGISTRY}"
echo " Tag:      ${TAG}"
echo " Dry run:  ${DRY_RUN}"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# Services built from the monorepo root context (Turbo pruning Dockerfiles)
# ---------------------------------------------------------------------------
TURBO_SERVICES=(
  openldr-web
  openldr-studio
  openldr-entity-services
  openldr-data-processing
  openldr-external-database
  openldr-mcp-server
  openldr-init
)

for svc in "${TURBO_SERVICES[@]}"; do
  echo "--- Building ${svc} (monorepo context) ---"
  run docker build \
    -t "${REGISTRY}/${svc}:${TAG}" \
    -f "apps/${svc}/Dockerfile" \
    .
  if [[ "$PUSH" == "true" ]]; then
    run docker push "${REGISTRY}/${svc}:${TAG}"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# Gateway — built from its own context
# ---------------------------------------------------------------------------
echo "--- Building openldr-gateway ---"
run docker build \
  -t "${REGISTRY}/openldr-gateway:${TAG}" \
  -f apps/openldr-gateway/Dockerfile \
  apps/openldr-gateway/
if [[ "$PUSH" == "true" ]]; then
  run docker push "${REGISTRY}/openldr-gateway:${TAG}"
fi
echo ""

# ---------------------------------------------------------------------------
# AI service — built from its own context
# ---------------------------------------------------------------------------
echo "--- Building openldr-ai ---"
run docker build \
  -t "${REGISTRY}/openldr-ai:${TAG}" \
  -f apps/openldr-ai/Dockerfile \
  apps/openldr-ai/
if [[ "$PUSH" == "true" ]]; then
  run docker push "${REGISTRY}/openldr-ai:${TAG}"
fi
echo ""

# ---------------------------------------------------------------------------
# Internal database (Postgres + extensions) — built from its own context
# ---------------------------------------------------------------------------
echo "--- Building openldr-internal-database ---"
run docker build \
  -t "${REGISTRY}/openldr-internal-database:${TAG}" \
  -f apps/openldr-internal-database/Dockerfile.postgres \
  apps/openldr-internal-database/
if [[ "$PUSH" == "true" ]]; then
  run docker push "${REGISTRY}/openldr-internal-database:${TAG}"
fi
echo ""

echo "============================================="
echo " Done! Images pushed to ${REGISTRY}/*:${TAG}"
echo "============================================="
