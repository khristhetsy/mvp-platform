-- Reg CF AI Materials Generator: stores founder-owned DRAFT documents only.
-- Disclosure/prep content; no offering, transaction, or signature. Additive.
-- Ships OFF by default — admin enables via Feature Controls (founder:regcf).

create table if not exists public.regcf_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete set null,
  founder_id  uuid not null references public.profiles(id) on delete cascade,
  doc_key     text not null,
  content     text,
  ai_generated boolean not null default false,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (founder_id, doc_key)
);

create index if not exists regcf_documents_founder_idx on public.regcf_documents(founder_id);

alter table public.regcf_documents enable row level security;

-- Founders manage their own drafts only.
drop policy if exists regcf_documents_founder on public.regcf_documents;
create policy regcf_documents_founder on public.regcf_documents
  for all to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

-- Feature keys/audiences are validated in app code, not the DB. Drop the
-- legacy check constraints so new keys (like regcf) don't need a schema change.
alter table public.feature_flags drop constraint if exists feature_flags_feature_check;
alter table public.feature_flags drop constraint if exists feature_flags_audience_check;

-- Seed the feature flag OFF for founders (admin flips it on after CCO sign-off).
insert into public.feature_flags (audience, feature, enabled)
values ('founder', 'regcf', false)
on conflict (audience, feature) do nothing;
