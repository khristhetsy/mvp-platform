#!/bin/bash
# Ships the LinkedIn import "no limit" fix to production (main), leaving your current branch alone.
LOG="$HOME/mvp-platform/ship-linkedin-no-limit.log"
exec > >(tee "$LOG") 2>&1
set -e
REPO="$HOME/mvp-platform"
WT="/tmp/icapos-linkedin-fix-$$"
cd "$REPO"
echo "== fetch"; git fetch origin
echo "== worktree from origin/main"; git worktree add -B fix/linkedin-import-no-limit "$WT" origin/main
cd "$WT"
echo "== apply"; git apply "$REPO/linkedin-import-no-limit.patch"
git add src/app/api/sales/contacts/linkedin-import/route.ts
git commit -m "fix(sales): LinkedIn import accepts any file size and never rejects a batch over one long field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L5JBrGBb1DinH7n2ri6y7D"
echo "== push to main (Vercel deploys production)"; git push origin HEAD:main
cd "$REPO"
git worktree remove "$WT" --force
git branch -D fix/linkedin-import-no-limit
echo "== clean the same edit off your current branch (it is now on main)"
git checkout -- src/app/api/sales/contacts/linkedin-import/route.ts
echo "DONE_OK"
