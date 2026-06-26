-- Migration: 20260627004_event_point_rules.sql
-- iCFO Events — configurable gamification point values. Staff can tune how many
-- points each participation action is worth, without a code change. Awards read
-- these via the service role (falling back to code defaults if a row is missing).

create table if not exists public.event_point_rules (
  action     text primary key,
  points     integer not null default 0 check (points >= 0 and points <= 1000),
  updated_at timestamptz not null default now()
);

drop trigger if exists event_point_rules_touch on public.event_point_rules;
create trigger event_point_rules_touch before update on public.event_point_rules
  for each row execute function public.touch_updated_at();

-- Seed defaults (idempotent).
insert into public.event_point_rules (action, points) values
  ('register',             10),
  ('session_viewed',       15),
  ('applied',              20),
  ('approved',             50),
  ('networking_optin',      5),
  ('connection_accepted',  15)
on conflict (action) do nothing;

alter table public.event_point_rules enable row level security;

drop policy if exists event_point_rules_staff_all on public.event_point_rules;
create policy event_point_rules_staff_all on public.event_point_rules
  for all using (public.is_staff()) with check (public.is_staff());
