-- Migration: 20260627005_event_missions.sql
-- iCFO Events — gamification missions. A mission is a named set of participation
-- actions; completing all of them (within one event) earns a bonus + status.
-- Global definitions; completion is evaluated per attendee per event.

create table if not exists public.event_missions (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 500),
  required_actions text[] not null default '{}',
  bonus_points     integer not null default 0 check (bonus_points >= 0 and bonus_points <= 1000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists event_missions_touch on public.event_missions;
create trigger event_missions_touch before update on public.event_missions
  for each row execute function public.touch_updated_at();

alter table public.event_missions enable row level security;

-- staff: full
drop policy if exists event_missions_staff_all on public.event_missions;
create policy event_missions_staff_all on public.event_missions
  for all using (public.is_staff()) with check (public.is_staff());

-- authenticated members can read active missions (to show progress on event pages)
drop policy if exists event_missions_member_read on public.event_missions;
create policy event_missions_member_read on public.event_missions
  for select using (auth.uid() is not null and is_active = true);
