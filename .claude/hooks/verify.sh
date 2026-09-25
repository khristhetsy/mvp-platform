#!/usr/bin/env bash
# Runs when Claude Code tries to finish a task.
# Exit 0 = allow finish. Exit 2 = block finish and send stderr back to Claude to fix.

INPUT=$(cat)

# Prevent an endless loop: if Claude is already retrying after a failed check, let it stop.
if echo "$INPUT" | grep -q '"stop_hook_active": *true'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Skip checks when no TypeScript files changed (e.g. a question or docs only edit).
CHANGED=$(git diff --name-only HEAD -- '*.ts' '*.tsx' 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard -- '*.ts' '*.tsx' 2>/dev/null)
if [ -z "$CHANGED" ] && [ -z "$UNTRACKED" ]; then
  exit 0
fi

TSC_OUT=$(npx tsc --noEmit 2>&1); TSC_RC=$?
LINT_OUT=$(npm run lint --silent 2>&1); LINT_RC=$?

if [ $TSC_RC -ne 0 ] || [ $LINT_RC -ne 0 ]; then
  {
    echo "Verification failed. Fix these errors before finishing. Do not suppress them."
    if [ $TSC_RC -ne 0 ]; then
      echo "--- TypeScript (npx tsc --noEmit) ---"
      echo "$TSC_OUT" | head -40
    fi
    if [ $LINT_RC -ne 0 ]; then
      echo "--- Lint (npm run lint) ---"
      echo "$LINT_OUT" | head -40
    fi
  } >&2
  exit 2
fi

exit 0
