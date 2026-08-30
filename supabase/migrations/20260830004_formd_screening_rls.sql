-- Form D Desk — Investor Mode · §3.6 Screening + §3.7 RLS
-- Screening records verification checks (OFAC/SEC/IAPD). RLS: ingest/rollup jobs
-- get NO write grant on prospect_investors — both promotes run as the authenticated
-- staff user via their RPCs (mirrors the existing rule for contacts).
--
-- REVIEW CAREFULLY: the prospect_investors policy changes write access on an
-- existing table. Confirm nothing legitimate inserts prospect_investors via the
-- service role before running. Additive + idempotent.

create table if not exists public.formd_screening (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null check (subject_type in ('firm', 'principal')),
  subject_id    uuid not null,
  check_type    text not null,   -- ofac_sdn | sec_enforcement | iapd_status | crd_lookup
  result        text not null check (result in ('clear', 'hit', 'review', 'unavailable')),
  detail        jsonb,
  checked_at    timestamptz not null default now()
);

create index if not exists formd_screening_subject_idx
  on public.formd_screening (subject_type, subject_id, check_type, checked_at desc);

-- §3.7 — block service-role inserts into the prospecting table.
alter table public.prospect_investors enable row level security;

drop policy if exists prospect_investors_no_service_write on public.prospect_investors;
create policy prospect_investors_no_service_write
  on public.prospect_investors for insert to service_role with check (false);
