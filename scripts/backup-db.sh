#!/usr/bin/env bash
# Back up the signage SQLite database to /var/backups/signage with rotation.
# Designed to run daily under user `signage` via cron.
set -euo pipefail

DB=/var/www/digital-signage-app/backend/data/signage.db
DEST_DIR=/var/backups/signage
KEEP_DAYS=14

mkdir -p "$DEST_DIR"

STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DEST_DIR/signage-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT'"
else
  cp "$DB" "$OUT"
fi

gzip -f "$OUT"

find "$DEST_DIR" -name 'signage-*.db.gz' -type f -mtime +"$KEEP_DAYS" -delete

echo "[$(date -u +%FT%TZ)] backup ok: ${OUT}.gz"
