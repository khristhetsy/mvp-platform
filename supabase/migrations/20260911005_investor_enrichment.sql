-- AI-proposed enrichment for investor contacts missing matching data. Proposals are
-- reviewed before they're trusted; on approval they're written to crm_contacts.overrides
-- with inv_source = 'inferred' (never overwriting verified/self_reported). Additive.

create table if not exists public.investor_enrichment (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null references public.crm_contacts(id) on delete cascade,
  proposed_industries text[] not null default '{}',
  proposed_type       text,
  confidence          numeric not null default 0,   -- 0–100
  basis               text,                          -- 'domain' | 'name' | 'website'
  rationale           text,
  model               text,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (contact_id)                                -- one live proposal per contact (re-run upserts)
);

create index if not exists investor_enrichment_status_idx on public.investor_enrichment (status, confidence desc);
