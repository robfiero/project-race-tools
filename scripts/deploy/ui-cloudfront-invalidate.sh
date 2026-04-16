#!/usr/bin/env bash
# Invalidate the CloudFront distribution cache after a frontend deploy.
# Usage: ui-cloudfront-invalidate.sh <DISTRIBUTION_ID>
set -euo pipefail

DISTRIBUTION_ID="$1"

echo "→ Invalidating CloudFront distribution ${DISTRIBUTION_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"

echo "✓ Invalidation submitted."
