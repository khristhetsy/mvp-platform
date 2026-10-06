-- Message activity goals (Admin, Analytics, Messages).
-- Additive only: one new table. Nothing existing is renamed, altered or dropped.
--
-- One row per metric per starting month. A goal applies from its month until a
-- later row for the same metric replaces it, so past periods keep being measured
-- against the goal that applied at the time. per_month null means the goal was
-- stopped from that month.

create table if not exists public.message_activity_goals (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null check (metric_key in (
    'f_email', 'f_rem', 'f_alert', 'f_remed', 'f_intro', 'f_other',
    'i_preview', 'i_reach', 'i_intro', 'i_contacted', 'i_diy'
  )),
  effective_month date not null check (effective_month = date_trunc('month', effective_month)::date),
  per_month numeric(12, 2) check (per_month is null or per_month >= 0),
  -- What was typed, so the editor can show it back ("25 per week").
  amount numeric(12, 2) check (amount is null or amount >= 0),
  basis text check (basis is null or basis in ('day', 'week', 'month', 'quarter', 'year')),
  direction text not null default 'up' check (direction in ('up', 'down')),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (metric_key, effective_month)
);

alter table public.message_activity_goals enable row level security;

-- Staff read the goals. Writes go through the service role only (the staff API
-- route checks the manage_reports permission first). Founders and investors get nothing.
drop policy if exists message_activity_goals_staff_read on public.message_activity_goals;
create policy message_activity_goals_staff_read on public.message_activity_goals
  for select using (public.is_staff());
