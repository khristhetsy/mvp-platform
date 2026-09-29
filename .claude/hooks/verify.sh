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

# Tests that import the changed files (directly or through other modules).
# Deleted files are left out; vitest finds the related test files itself.
TEST_RC=0
TEST_OUT=""
FILES=$(printf '%s\n%s\n' "$CHANGED" "$UNTRACKED" | grep -v '^$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
if [ -n "$FILES" ]; then
  # shellcheck disable=SC2086
  TEST_OUT=$(npx vitest related --run --passWithNoTests $FILES 2>&1); TEST_RC=$?
fi

if [ $TSC_RC -ne 0 ] || [ $LINT_RC -ne 0 ] || [ $TEST_RC -ne 0 ]; then
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
    if [ $TEST_RC -ne 0 ]; then
      echo "--- Related tests (npx vitest related) ---"
      echo "$TEST_OUT" | grep -E "FAIL|✗|×|AssertionError|Error:|expected|Test Files|Tests " | head -40
    fi
  } >&2
  exit 2
fi

exit 0
