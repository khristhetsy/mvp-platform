#!/usr/bin/env bash
# Non-destructive storage inventory manifest (not a full object download).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"

echo "CapitalOS storage backup helper"
echo "================================"
echo "This script writes a bucket/object inventory manifest only."
echo "Full file backup is not automated here (size, rate limits, and safety)."
echo ""
echo "Recommended full storage backup options:"
echo "  1. Supabase Dashboard → Storage → export objects per bucket as needed"
echo "  2. Supabase CLI (if configured): supabase storage ls / cp for controlled copies"
echo "  3. Periodic manual export of pitch-decks and spv-investor-documents before major releases"
echo ""

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  if [[ -f "$ROOT/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source <(grep -v '^#' "$ROOT/.env.local" | sed '/^\s*$/d' | sed 's/\r$//')
    set +a
  fi
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for inventory manifest."
  node "$ROOT/scripts/record-backup-event.mjs" backup.storage.failed error '{"reason":"missing_supabase_env"}' 2>/dev/null || true
  exit 1
fi

export BACKUP_DIR
if node "$ROOT/scripts/storage-manifest.mjs"; then
  node "$ROOT/scripts/record-backup-event.mjs" backup.storage.manifest.completed info "{\"backupDir\":\"$BACKUP_DIR\"}" 2>/dev/null || true
else
  node "$ROOT/scripts/record-backup-event.mjs" backup.storage.failed error '{"reason":"manifest_failed"}' 2>/dev/null || true
  exit 1
fi
