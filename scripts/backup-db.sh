#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/mongodb}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mongo_backup_$TIMESTAMP.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting MongoDB backup to $BACKUP_FILE..."

# Find running mongo container in docker-compose
CONTAINER_ID=$(docker compose ps -q mongodb 2>/dev/null || docker ps -q --filter "name=mongodb" | head -n 1)

if [[ -z "$CONTAINER_ID" ]]; then
  echo "Error: MongoDB container is not running!"
  exit 1
fi

docker exec "$CONTAINER_ID" mongodump --db=cafe_db --archive --gzip > "$BACKUP_FILE"

echo "✓ Backup completed successfully: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep last 14 days of backups, remove older ones
find "$BACKUP_DIR" -name "mongo_backup_*.gz" -mtime +14 -exec rm {} \;
echo "Cleaned up backups older than 14 days."
