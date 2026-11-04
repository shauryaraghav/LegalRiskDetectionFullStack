#!/usr/bin/env bash
# Runs ON the server (cron, daily). Dumps Postgres and uploads it to the S3 backup bucket.
# Restore: gunzip -c legalrisk-<ts>.sql.gz | docker compose exec -T db psql -U legalrisk legalrisk
set -euo pipefail
cd /opt/legalrisk
set -a; . ./.env; set +a
ts="$(date -u +%Y%m%dT%H%M%SZ)"
file="/tmp/legalrisk-${ts}.sql.gz"
docker compose exec -T db pg_dump -U legalrisk legalrisk | gzip > "$file"
aws s3 cp "$file" "s3://${BACKUP_BUCKET}/db/legalrisk-${ts}.sql.gz" --only-show-errors
rm -f "$file"
echo "backup ${ts} ok"
