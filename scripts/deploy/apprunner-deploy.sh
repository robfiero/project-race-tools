#!/usr/bin/env bash
# Trigger an App Runner deployment with a new image identifier.
# Usage: apprunner-deploy.sh <SERVICE_ARN> <IMAGE_IDENTIFIER> <AWS_REGION>
set -euo pipefail

SERVICE_ARN="$1"
IMAGE_IDENTIFIER="$2"
AWS_REGION="$3"

echo "→ Updating App Runner service..."
aws apprunner update-service \
  --region "${AWS_REGION}" \
  --service-arn "${SERVICE_ARN}" \
  --source-configuration \
    "ImageRepository={ImageIdentifier=${IMAGE_IDENTIFIER},ImageRepositoryType=ECR}"

echo "✓ Deployment triggered. Monitor progress in the App Runner console."
