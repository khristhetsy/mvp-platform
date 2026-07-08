-- CEO Hub v2 — meeting recurrence + one-off occurrences, and the metric-aware
-- daily "phrase of the day". Recurrence reuses the existing ceo_meetings.cadence
-- column (weekly | biweekly | monthly). Occurrences are one-off scheduled dates
-- layered on top of the recurring slot; both render in the new calendar views.
-- Admin-only; gated by the existing is_staff() helper like the rest of ceo_*.

-- Normalize cadence to the recurrence vocabulary the UI uses.
alter table public.ceo_meetings
  alter column cadence set default 'weekly';
update public.ceo_meetings set cadence = 'weekly'
  where cadence is null or cadence not in ('weekly','biweekly','monthly');

-- One-off scheduled occurrences (a specific date/time for a meeting, in addition
-- to the recurring slot). gcal_event_id is set if synced to Google Calendar.
create table if not exists public.ceo_meeting_occurrences (
  id uuid primary key default gen_random_uuid(),
  meeting_key text not null references public.ceo_meetings(key) on delete cascade,
  occurs_on date not null,
  time_local time,
  duration_min int,
  note text,
  gcal_event_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (meeting_key, occurs_on)
);
create index if not exists ceo_meeting_occurrences_date_idx
  on public.ceo_meeting_occurrences (occurs_on);

-- Metric-aware daily phrase shown on the CEO Hub dashboard (one row per day).
create table if not exists public.ceo_daily_phrase (
  id uuid primary key default gen_random_uuid(),
  business ceo_business not null default 'icapos',
  phrase_date date not null,
  phrase text not null,
  model text,
  created_at timestamptz default now(),
  unique (business, phrase_date)
);

-- RLS — reuse is_staff() (admin/analyst), same as every other ceo_* table.
alter table public.ceo_meeting_occurrences enable row level security;
alter table public.ceo_daily_phrase        enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['ceo_meeting_occurrences','ceo_daily_phrase'] loop
    execute format('drop policy if exists %I_staff on public.%I', tbl, tbl);
    execute format('create policy %I_staff on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', tbl, tbl);
  end loop;
end $$;
