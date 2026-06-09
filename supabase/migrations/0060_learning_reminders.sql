-- Learning reminder queue (data layer only; delivery handled separately).

create table if not exists public.learning_reminders (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (
    type in ('inactivity_nudge', 'milestone_celebration', 'weekly_digest')
  ),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_reminders_pending_idx
  on public.learning_reminders (scheduled_at)
  where sent_at is null;

create index if not exists learning_reminders_founder_idx on public.learning_reminders (founder_id);

alter table public.learning_reminders enable row level security;

drop policy if exists "learning_reminders_select_own" on public.learning_reminders;
create policy "learning_reminders_select_own"
  on public.learning_reminders for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "learning_reminders_select_staff" on public.learning_reminders;
create policy "learning_reminders_select_staff"
  on public.learning_reminders for select to authenticated
  using (public.is_staff());
