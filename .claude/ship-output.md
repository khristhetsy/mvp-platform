# Ship output

Applies to every task that changes files in this repo.

**Print only. Never execute.** You do not run `git add`, `git commit`,
`git push`, `supabase db push`, or any migration. Not when the change
is small, not when I said "go ahead" earlier in the session, not when
a previous turn's commands failed. Your job ends at printing the
commands. I run them.

When you have finished implementing something and are about to hand
back, end your final message with a section headed `## Ship it`
containing the following, in this order.

## 1. Git commands (always)

A single bash block with the real commands for this specific change.
No placeholders, no `<your-message-here>`, no `.` when you can name
the files.

```bash
git add path/to/file-a.ts path/to/file-b.tsx
git commit -m "feat(crr): add stage-based weighting profile"
git push origin <current-branch>
```

Rules:
- Read the actual branch with `git rev-parse --abbrev-ref HEAD`. Do
  not assume `main`.
- Name the files you actually touched. If there are more than eight,
  group them and use directory paths.
- Conventional commit format, scoped to the area of iCapOS you
  changed (`crr`, `matching`, `event-hub`, `marketing`, `auth`).
- Do not run any of these. Print them and stop.

## 2. SQL commands (only if applicable)

Applies when the change added or modified anything in
`supabase/migrations/`, or when a code change assumes a schema,
enum, RLS policy, or seed row that does not exist yet in the
database.

Print the full SQL in a `sql` block, followed by the command to
apply it:

```bash
supabase db push
```

Rules:
- Show the complete migration for review before it runs. Never
  execute a migration yourself.
- If the change adds a column that existing rows need backfilled,
  include the backfill `UPDATE` as a separate statement and say so.
- If the change touches RLS, state in one line which roles gain or
  lose access.
- If no schema change is involved, write `No SQL needed` and move
  on. Do not invent a migration to fill the section.

## 3. Deploy note (one line)

State what happens on push — which Vercel environment this branch
builds to, and whether any environment variable must be set before
the deploy will succeed.

## Never

- Never write "let me know if you'd like me to push this."
- Never leave the section out because the change felt small.
- Never combine the git block and the SQL block. They are separate
  because they run at different times and one can fail without the
  other.
