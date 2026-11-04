#!/usr/bin/env bash
# Runs ON the server. Usage: deploy.sh <image-tag>
# Pulls the new images, restarts the stack, waits for the backend health check, rolls back if it never gets healthy.
set -euo pipefail
cd /opt/legalrisk
NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
PREV_TAG="$(cat .deployed_tag 2>/dev/null || true)"

backend_healthy() {
  for _ in $(seq 1 36); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q backend)" 2>/dev/null || echo none)"
    [ "$status" = "healthy" ] && return 0
    sleep 5
  done
  return 1
}

export IMAGE_TAG="$NEW_TAG"
docker compose pull backend frontend
docker compose up -d --remove-orphans

if backend_healthy; then
  echo "$NEW_TAG" > .deployed_tag
  docker image prune -af --filter "until=168h" >/dev/null
  echo "deployed $NEW_TAG"
else
  echo "::error::backend did not become healthy" >&2
  docker compose logs --tail=60 backend >&2 || true
  if [ -n "$PREV_TAG" ]; then
    echo "rolling back to $PREV_TAG" >&2
    export IMAGE_TAG="$PREV_TAG"
    docker compose up -d
  fi
  exit 1
fi
