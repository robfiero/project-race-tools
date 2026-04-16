#!/usr/bin/env bash
# Build and deploy the frontend: builds Vite app, syncs to S3, invalidates CloudFront.
# Usage: ./scripts/release-ui.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

source "${SCRIPT_DIR}/env/prod.env.example"
[[ -f "${SCRIPT_DIR}/env/prod.local.env" ]] && source "${SCRIPT_DIR}/env/prod.local.env"

export VITE_API_BASE_URL="https://${API_DOMAIN}"

echo "=== RaceStats frontend release ==="
echo "    API base  : ${VITE_API_BASE_URL}"
echo "    S3 bucket : ${S3_BUCKET_UI}"
echo "    CloudFront: ${CLOUDFRONT_DISTRIBUTION_ID}"
echo ""

"${SCRIPT_DIR}/build/ui-build.sh"
"${SCRIPT_DIR}/deploy/ui-deploy-s3.sh" "${S3_BUCKET_UI}"
"${SCRIPT_DIR}/deploy/ui-cloudfront-invalidate.sh" "${CLOUDFRONT_DISTRIBUTION_ID}"

echo ""
echo "=== Frontend release complete ==="
