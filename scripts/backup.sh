#!/bin/bash
# Automated database backup script for CRVAP
# Runs pg_dump and compresses output; retains last 30 days
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups
DB_HOST=${DB_HOST:-db}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-climatedb}
BACKUP_FILE="$BACKUP_DIR/climatedb_$TIMESTAMP.sql.gz"

echo "[backup] Starting database backup at $(date)"

# Run pg_dump and compress
pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verify the backup file is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[backup] ERROR: Backup file is empty, removing"
    rm -f "$BACKUP_FILE"
    exit 1
fi

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] Backup created: $BACKUP_FILE ($FILESIZE)"

# Retain last 30 days, remove older backups
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[backup] Removed $DELETED backup(s) older than 30 days"
fi

echo "[backup] Backup complete at $(date)"
