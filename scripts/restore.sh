#!/bin/bash
# Restore database from a backup file
# Usage: ./scripts/restore.sh <backup_file.sql.gz>
set -e

BACKUP_FILE=${1:?Usage: $0 <backup_file.sql.gz>}
DB_HOST=${DB_HOST:-db}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-climatedb}

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=== CRVAP Database Restore ==="
echo "Backup:   $BACKUP_FILE"
echo "Database: $DB_NAME"
echo ""
echo "WARNING: This will drop and recreate the database."
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[restore] Dropping and recreating database..."
psql -h "$DB_HOST" -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" postgres 2>/dev/null || true
psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres

echo "[restore] Restoring from backup..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -U "$DB_USER" "$DB_NAME"

echo "[restore] Restore complete."
