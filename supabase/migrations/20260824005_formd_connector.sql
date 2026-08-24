-- SEC Form D connector (build spec §3). Two mirror tables, never written by a
-- human and never writing to contacts. RLS: admin/analyst read, service-role write.
-- NOTE: the contacts columns (§3.3) are in a SEPARATE statement block at the bottom
-- and reference the app's contacts table — adjust the table name if yours differs.

create table if not exists public.formd_filings (
  accession_no          text primary key,
  cik                   text not null,
  form_type             text not null,          -- 'D' | 'D/A'
  is_amendment          boolean default false,
  date_filed            date,

  company_name          text not null,
  phone                 text,
  street1               text, street2 text,
  city                  text, state text, zip_code text,
  entity_type           text,
  jurisdiction          text,
  year_of_inc           text,

  industry              text,
  is_fund               boolean default false,
  revenue_range         text,
  exemptions            text,
  is_506c               boolean default false,

  total_offering        numeric,
  total_sold            numeric,
  total_remaining       numeric,
  pct_sold              numeric,
  min_investment        numeric,
  investor_count        int,

  date_first_sale       date,
  sale_yet_to_occur     boolean default false,
  days_since_first_sale int,

  has_placement_agent   boolean default false,
  placement_agents      text,
  sales_commission      numeric,

  signer_name           text,
  signer_title          text,

  formd_score           int,
  score_notes           text,

  derived_funding_stage text,
  derived_investor_type text,

  filing_url            text,
  promoted_contact_id   uuid,
  promoted_at           timestamptz,
  held_for_review       boolean default false,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists formd_filings_cik_idx on public.formd_filings (cik);
create index if not exists formd_filings_queue_idx on public.formd_filings (formd_score desc)
  where promoted_contact_id is null;
create index if not exists formd_filings_stall_idx on public.formd_filings (days_since_first_sale)
  where promoted_contact_id is null and has_placement_agent = false;

create table if not exists public.formd_related_persons (
  id            uuid primary key default gen_random_uuid(),
  accession_no  text not null references public.formd_filings(accession_no) on delete cascade,
  first_name    text, middle_name text, last_name text,
  full_name     text not null,
  relationships text,
  city          text, state text,
  is_signer     boolean default false,
  created_at    timestamptz default now()
  -- Street addresses of related persons are intentionally NOT stored (§3.2/§13.7).
);

create index if not exists formd_related_persons_acc_idx on public.formd_related_persons (accession_no);

-- RLS: staff read, service-role write only. The ingest job has NO contacts grant.
alter table public.formd_filings enable row level security;
alter table public.formd_related_persons enable row level security;

drop policy if exists formd_filings_staff_read on public.formd_filings;
create policy formd_filings_staff_read on public.formd_filings
  for select using (public.is_staff());

drop policy if exists formd_related_staff_read on public.formd_related_persons;
create policy formd_related_staff_read on public.formd_related_persons
  for select using (public.is_staff());

-- (No insert/update/delete policies → only the service role can write.)

-- ── §3.3 Contacts additions — dedupe key + provenance for Form D contacts ──
-- Adjust the table name if the app's contacts table isn't public.contacts.
alter table public.contacts add column if not exists formd_cik text;
alter table public.contacts add column if not exists formd_accession_no text;
create index if not exists contacts_formd_cik_idx on public.contacts (formd_cik);
