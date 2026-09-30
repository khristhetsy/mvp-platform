-- Saved IR auto sequences, built from the task Matching tab's "Enroll in sequence" menu.
-- The built-in sequences stay in code (src/lib/ir/sequence-templates.ts); these sit
-- beside them. An enrollment copies the steps, so editing or removing a saved sequence
-- never changes one already running.
-- Staff read and write through the admin API with the service role, so RLS is on with no
-- policies, the same as ir_sequence_enrollments.

create table if not exists public.ir_sequence_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  steps       jsonb not null,                       -- [{ day, subject, body }]
  stop_on     text[] not null default '{reply,meeting}',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ir_sequence_templates enable row level security;
