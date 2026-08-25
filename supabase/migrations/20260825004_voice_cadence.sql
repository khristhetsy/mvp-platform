-- Multichannel cadence engine. A campaign's cadence_steps define an ordered
-- sequence of touches (voice / sms / whatsapp / email) with a delay before each.
-- Contacts are enrolled into voice_cadence_enrollments; a cron tick fires steps
-- that are due and advances each contact, stopping on completion / opt-out.
-- Every step still passes its channel gate (consent/DNC/hours) — the cadence
-- only decides WHEN, never bypasses consent.
--
-- cadence_steps shape (jsonb array):
--   [ { "channel": "voice", "delayHours": 0 },
--     { "channel": "sms",   "delayHours": 48, "body": "Following up…" },
--     { "channel": "whatsapp", "delayHours": 72, "body": "…" } ]
--
-- Apply on staging, verify, then production (migrations need human approval).

alter table public.voice_campaigns
  add column if not exists cadence_steps jsonb;

create table if not exists public.voice_cadence_enrollments (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.voice_campaigns(id) on delete cascade,
  contact_id   text not null,
  current_step int not null default 0,
  status       text not null default 'active'
    check (status in ('active', 'completed', 'stopped')),
  next_run_at  timestamptz not null default now(),
  last_error   text,
  enrolled_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

-- The tick query: active enrollments whose next step is due.
create index if not exists voice_cadence_due_idx
  on public.voice_cadence_enrollments (next_run_at)
  where status = 'active';

alter table public.voice_cadence_enrollments enable row level security;

drop policy if exists voice_cadence_staff_read on public.voice_cadence_enrollments;
create policy voice_cadence_staff_read on public.voice_cadence_enrollments
  for select using (public.is_staff());
-- No write policies → only the service role advances the cadence.
