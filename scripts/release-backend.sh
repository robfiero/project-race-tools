#!/usr/bin/env bash
# Build and deploy the backend: builds Docker image, pushes to ECR, triggers App Runner deploy.
# Usage: ./scripts/release-backend.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

source "${SCRIPT_DIR}/env/prod.env.example"
[[ -f "${SCRIPT_DIR}/env/prod.local.env" ]] && source "${SCRIPT_DIR}/env/prod.local.env"

# Use immutable image tags by default to force unambiguous App Runner deployments.
RESOLVED_IMAGE_TAG="${BACKEND_IMAGE_TAG:-latest}"
if [[ -z "${BACKEND_IMAGE_TAG:-}" || "${BACKEND_IMAGE_TAG}" == "latest" ]]; then
  timestamp="$(date -u +"%Y%m%d-%H%M%S")"
  if git_sha="$(git rev-parse --short HEAD 2>/dev/null)"; then
    RESOLVED_IMAGE_TAG="${git_sha}-${timestamp}"
  else
    RESOLVED_IMAGE_TAG="manual-${timestamp}"
  fi
fi

IMAGE_IDENTIFIER="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${RESOLVED_IMAGE_TAG}"

echo "=== RaceStats backend release ==="
echo "    Tag   : ${RESOLVED_IMAGE_TAG}"
echo "    Image : ${IMAGE_IDENTIFIER}"
echo "    Service: ${APP_RUNNER_SERVICE_ARN}"
echo ""

"${SCRIPT_DIR}/build/backend-build-push.sh" \
  "${AWS_REGION}" \
  "${AWS_ACCOUNT_ID}" \
  "${ECR_REPOSITORY}" \
  "${RESOLVED_IMAGE_TAG}"

"${SCRIPT_DIR}/deploy/apprunner-deploy.sh" \
  "${APP_RUNNER_SERVICE_ARN}" \
  "${IMAGE_IDENTIFIER}" \
  "${AWS_REGION}"

echo ""
echo "=== Backend release complete ==="
