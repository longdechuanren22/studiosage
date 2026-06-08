#!/bin/bash
# StudioSage deployment script
# Usage: VPS_HOST=1.2.3.4 VPS_USER=root ./scripts/deploy.sh

set -e

VPS="${VPS_HOST:-}"
USER="${VPS_USER:-root}"
APP="studiosage"

if [ -z "$VPS" ]; then
  echo "Set VPS_HOST and VPS_USER environment variables."
  echo "Usage: VPS_HOST=1.2.3.4 VPS_USER=root ./scripts/deploy.sh"
  exit 1
fi

echo "Building..."
cd "$(dirname "$0")/.."
docker build -t $APP:latest .

echo "Deploying to $USER@$VPS..."
ssh "$USER@$VPS" "mkdir -p /app/$APP"

scp docker-compose.yml "$USER@$VPS:/app/$APP/"
scp .env "$USER@$VPS:/app/$APP/.env" 2>/dev/null || echo "Warning: .env not found, create it on the server"

ssh "$USER@$VPS" "cd /app/$APP && docker-compose pull 2>/dev/null; docker-compose up -d --build"

echo "Done. Check: https://$VPS:3001/api/health"
