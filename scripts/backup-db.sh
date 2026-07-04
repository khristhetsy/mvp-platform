#!/usr/bin/env bash
# Non-destructive Postgres backup via pg_dump. Requires DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"

# Resolve DATABASE_URL. Prefer an already-exported value (e.g. passed inline on
# the command line); otherwise read it LITERALLY from .env.local.
#
# We intentionally do NOT `source` the env file: sourcing evaluates each line as
# shell, so a special character in the password (# $ & ! ' " | space, backtick,
# etc.) breaks the assignment and silently leaves DATABASE_URL empty. Parsing the
# single line by hand preserves the value exactly as written.
if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/.env.local" ]]; then
  __db_line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$ROOT/.env.local" | tail -n1 || true)"
  if [[ -n "$__db_line" ]]; then
    __db_val="${__db_line#*=}"          # everything after the first '='
    __db_val="${__db_val%$'\r'}"        # strip trailing CR (CRLF files)
    if [[ "$__db_val" == \"*\" ]]; then # strip one layer of surrounding quotes
      __db_val="${__db_val#\"}"; __db_val="${__db_val%\"}"
    elif [[ "$__db_val" == \'*\' ]]; then
      __db_val="${__db_val#\'}"; __db_val="${__db_val%\'}"
    fi
    export DATABASE_URL="$__db_val"
  fi
fi

DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Add it to .env.local (Supabase → Project Settings → Database → Connection string)."
  echo "Alternatively use Supabase Dashboard → Database → Backups for managed snapshots."
  node "$ROOT/scripts/record-backup-event.mjs" backup.database.failed error '{"reason":"missing_DATABASE_URL"}' 2>/dev/null || true
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install PostgreSQL client tools or use Supabase managed backups."
  node "$ROOT/scripts/record-backup-event.mjs" backup.database.failed error '{"reason":"pg_dump_missing"}' 2>/dev/null || true
  exit 1
fi

STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTFILE="$BACKUP_DIR/db-${STAMP}.sql.gz"

echo "Writing backup to $OUTFILE (read-only pg_dump)..."
if pg_dump "$DATABASE_URL" --no-owner --no-acl --format=plain | gzip -c > "$OUTFILE"; then
  SIZE="$(wc -c < "$OUTFILE" | tr -d ' ')"
  if [[ "$SIZE" -lt 128 ]]; then
    echo "ERROR: Backup file is unexpectedly small (${SIZE} bytes)."
    node "$ROOT/scripts/record-backup-event.mjs" backup.database.failed error "{\"file\":\"$OUTFILE\",\"bytes\":$SIZE}" 2>/dev/null || true
    exit 1
  fi
  echo "Backup complete (${SIZE} bytes)."
  node "$ROOT/scripts/record-backup-event.mjs" backup.database.completed info "{\"file\":\"$OUTFILE\",\"bytes\":$SIZE}" 2>/dev/null || true
else
  echo "ERROR: pg_dump failed."
  node "$ROOT/scripts/record-backup-event.mjs" backup.database.failed error '{"reason":"pg_dump_failed"}' 2>/dev/null || true
  exit 1
fi
