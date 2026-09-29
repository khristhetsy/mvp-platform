---
description: Print the git push and SQL commands for the current uncommitted work
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git log:*), Read, Glob, Grep
---

Inspect the current state of the working tree and print the commands
needed to ship it. Do not run anything that mutates state.

Gather first:
- `git rev-parse --abbrev-ref HEAD` for the branch
- `git status --short` for changed files
- `git diff --stat` for the shape of the change
- `git log --oneline -3` to match the existing commit message style

Then output exactly three things:

**1. A bash block** staging the specific changed files, committing
with a conventional-commit message that describes what actually
changed, and pushing to the branch you read above.

**2. A sql block** if `supabase/migrations/` contains a migration
not yet reflected in the remote schema, or if the code changes
depend on a schema change that has not been written yet. Include
the apply command underneath. If neither is true, write
`No SQL needed`.

**3. One line** on what this push triggers on Vercel.

If the working tree is clean, say so and stop — do not fabricate a
commit.
