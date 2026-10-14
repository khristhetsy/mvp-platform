-- Reminders behind the clock icon in the top bar: personal Task, To-do, Follow up and Call
-- items with a due time (entered in PT, stored as timestamptz). Each person sees only their own.
-- The reminder-alerts cron sets notified_at when it sends the in-app and email alert. Idempotent.
create table if not exists public.user_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind text not null default 'task' check (kind in ('task', 'todo', 'follow_up', 'call')),
  due_at timestamptz not null,
  done_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_reminders_user_open_idx
  on public.user_reminders (user_id, due_at) where done_at is null;

create index if not exists user_reminders_alert_idx
  on public.user_reminders (due_at) where done_at is null and notified_at is null;

alter table public.user_reminders enable row level security;

drop policy if exists user_reminders_own on public.user_reminders;
create policy user_reminders_own on public.user_reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
