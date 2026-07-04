-- =====================================================================
-- Prospect Pipeline & Marketing Hub — combined migration (Steps 0/2/4/5)
-- Paste-once into the Supabase SQL editor. Fully idempotent & additive.
-- Run on STAGING first, verify, then PRODUCTION.
-- (This mirrors: 20260704003, 20260704004, 20260704005, 20260704006.)
-- =====================================================================

-- ── Step 0/1: pipeline columns on crm_contacts (single source of record) ──
alter table public.crm_contacts
  add column if not exists side text check (side in ('founder','investor')),
  add column if not exists side_confidence int check (side_confidence between 0 and 100),
  add column if not exists company_domain text,
  add column if not exists email_status text default 'unverified'
    check (email_status in ('unverified','valid','risky','invalid')),
  add column if not exists email_source text
    check (email_source in ('given','site','profile','provider')),
  add column if not exists phone text,
  add column if not exists phone_source text,
  add column if not exists contact_confidence int check (contact_confidence between 0 and 100),
  add column if not exists enrichment_status text default 'pending'
    check (enrichment_status in ('pending','enriched','no_website','failed')),
  add column if not exists signals jsonb not null default '{}'::jsonb,
  add column if not exists lead_prescore int check (lead_prescore between 0 and 100),
  add column if not exists prescore_dims jsonb,
  add column if not exists segment text check (segment in ('hot','warm','cold')),
  add column if not exists approach jsonb,
  add column if not exists converted boolean not null default false,
  add column if not exists suppressed boolean not null default false;

update public.crm_contacts
  set side = case when module in ('founder','investor') then module else null end
  where side is null and module in ('founder','investor');

create index if not exists idx_crm_contacts_side on public.crm_contacts (side);
create index if not exists idx_crm_contacts_segment on public.crm_contacts (segment);
create index if not exists idx_crm_contacts_email_lower on public.crm_contacts (lower(email));
create index if not exists idx_crm_contacts_prescore on public.crm_contacts (lead_prescore desc)
  where suppressed = false and converted = false;

-- ── Step 2: contact_sides view ──
create or replace view public.contact_sides as
select id, side as resolved_side, side_confidence, module, company, company_domain, email
from public.crm_contacts;

-- ── Step 4: lead_segments + hot_queue views ──
create or replace view public.lead_segments as
select id, side, coalesce(segment,'cold') as computed_segment, lead_prescore, approach
from public.crm_contacts
where side is not null and approach is not null;

create or replace view public.hot_queue as
select *
from public.crm_contacts
where segment = 'hot' and converted = false and suppressed = false
order by lead_prescore desc nulls last;

-- ── Step 5: publish schema ──
create table if not exists public.publish_items (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','social','aeo')),
  title text not null,
  body jsonb not null,
  segment text check (segment in ('hot','warm','cold')),
  wave text,
  batch int,
  status text not null default 'draft'
    check (status in ('draft','lint_flagged','ready','scheduled','sent','blocked')),
  lint_result jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  approved_by uuid references public.profiles(id),
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts(id),
  publish_id uuid references public.publish_items(id) on delete cascade,
  email text,
  resend_id text,
  event text check (event in ('sent','delivered','open','click','signup','unsub','bounce')),
  occurred_at timestamptz not null default now()
);

create index if not exists idx_publish_events_publish on public.publish_events (publish_id);
create index if not exists idx_publish_events_email on public.publish_events (lower(email));
create index if not exists idx_publish_events_resend on public.publish_events (resend_id);
create index if not exists idx_publish_items_status on public.publish_items (status);

-- Done. Verify: \d public.crm_contacts  and  select * from public.hot_queue limit 1;
