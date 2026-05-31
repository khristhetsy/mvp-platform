#!/usr/bin/env bash
# Verify latest local backup artifacts exist and are non-empty (no restore).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: Backup directory not found: $BACKUP_DIR"
  node "$ROOT/scripts/record-backup-event.mjs" backup.verification.failed error '{"reason":"backup_dir_missing"}' 2>/dev/null || true
  exit 1
fi

LATEST_DB="$(ls -t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | head -1 || true)"
LATEST_MANIFEST="$(ls -t "$BACKUP_DIR"/storage-manifest-*.json 2>/dev/null | head -1 || true)"

FAIL=0

if [[ -z "$LATEST_DB" ]]; then
  echo "WARN: No database backup found (db-*.sql.gz). Run scripts/backup-db.sh"
  FAIL=1
else
  DB_SIZE="$(wc -c < "$LATEST_DB" | tr -d ' ')"
  if [[ "$DB_SIZE" -lt 128 ]]; then
    echo "FAIL: Database backup too small: $LATEST_DB ($DB_SIZE bytes)"
    FAIL=1
  else
    echo "PASS: Database backup $LATEST_DB ($DB_SIZE bytes)"
  fi
fi

if [[ -z "$LATEST_MANIFEST" ]]; then
  echo "WARN: No storage manifest found. Run scripts/backup-storage.sh"
  FAIL=1
else
  MAN_SIZE="$(wc -c < "$LATEST_MANIFEST" | tr -d ' ')"
  if [[ "$MAN_SIZE" -lt 32 ]]; then
    echo "FAIL: Storage manifest too small: $LATEST_MANIFEST"
    FAIL=1
  else
    echo "PASS: Storage manifest $LATEST_MANIFEST ($MAN_SIZE bytes)"
  fi
fi

if [[ "$FAIL" -ne 0 ]]; then
  node "$ROOT/scripts/record-backup-event.mjs" backup.verification.failed error "{\"db\":\"${LATEST_DB:-none}\",\"manifest\":\"${LATEST_MANIFEST:-none}\"}" 2>/dev/null || true
  exit 1
fi

echo "Backup verification passed."
node "$ROOT/scripts/record-backup-event.mjs" backup.verification.passed info "{\"db\":\"$LATEST_DB\",\"manifest\":\"$LATEST_MANIFEST\"}" 2>/dev/null || true
