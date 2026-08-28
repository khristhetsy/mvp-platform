-- IR pivot — Step 3 & 4 tables.
--   assessment_leads: public no-account lead magnet capture (§4.2, §5.4).
--   funnel_events:    input-metric instrumentation across the funnel (§8).
-- Writes come only from server routes using the service role (no anon/public
-- write policy). Staff can read. Additive + idempotent.
-- Apply on staging, verify, then production (migrations need human approval).

create table if not exists public.assessment_leads (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  company_name         text,
  full_name            text,
  stage                text,                 -- pre_seed | seed | series_a_plus
  capital_structure    text,                 -- reg_d_506b | reg_d_506c | reg_cf | other | not_sure
  lead_prescore        int not null,         -- 0-100, never named `crr`
  score_band           text not null,        -- foundation | emerging | ready
  answers              jsonb not null default '{}'::jsonb,
  utm                  jsonb,
  converted_contact_id uuid,                  -- crm_contacts.id once upserted (loose ref)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists assessment_leads_email_idx
  on public.assessment_leads (lower(email));

alter table public.assessment_leads enable row level security;
drop policy if exists assessment_leads_staff_read on public.assessment_leads;
create policy assessment_leads_staff_read on public.assessment_leads
  for select using (public.is_staff());
-- No write policies → only the service role inserts/updates leads.

create table if not exists public.funnel_events (
  id              bigserial primary key,
  session_id      text not null,
  event_name      text not null,            -- see §8 funnel step names
  properties      jsonb,
  organization_id uuid,                      -- loose ref; nullable for pre-account events
  occurred_at     timestamptz not null default now()
);
create index if not exists funnel_events_name_time_idx
  on public.funnel_events (event_name, occurred_at);

alter table public.funnel_events enable row level security;
drop policy if exists funnel_events_staff_read on public.funnel_events;
create policy funnel_events_staff_read on public.funnel_events
  for select using (public.is_staff());
-- No write policies → only the service role records events.
