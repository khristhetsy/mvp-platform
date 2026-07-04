-- Prospect Pipeline — Step 0/1: additive pipeline columns on the live crm_contacts
-- mirror. crm_contacts stays the single source of record; marketing_contacts is a
-- kept-in-sync read model for the Hub. All columns are additive & idempotent.
--
-- Note: crm_contacts already has `source` (free text) and `module`
-- ('founder'|'investor'|'unknown') from the Odoo import. We keep those and add a
-- pipeline `side` (backfilled from module) plus the classify / verify / score /
-- approach fields the pipeline needs.

alter table public.crm_contacts
  -- classify
  add column if not exists side text
    check (side in ('founder','investor')),               -- null = unclassified
  add column if not exists side_confidence int
    check (side_confidence between 0 and 100),
  add column if not exists company_domain text,
  -- verify & append
  add column if not exists email_status text default 'unverified'
    check (email_status in ('unverified','valid','risky','invalid')),
  add column if not exists email_source text
    check (email_source in ('given','site','profile','provider')),
  add column if not exists phone text,
  add column if not exists phone_source text,
  add column if not exists contact_confidence int
    check (contact_confidence between 0 and 100),
  -- enrichment + score
  add column if not exists enrichment_status text default 'pending'
    check (enrichment_status in ('pending','enriched','no_website','failed')),
  add column if not exists signals jsonb not null default '{}'::jsonb,
  add column if not exists lead_prescore int
    check (lead_prescore between 0 and 100),
  add column if not exists prescore_dims jsonb,
  add column if not exists segment text
    check (segment in ('hot','warm','cold')),
  add column if not exists approach jsonb,                 -- {hook,timing,channel,priority,text}
  add column if not exists converted boolean not null default false,
  add column if not exists suppressed boolean not null default false;

-- Backfill side from the existing Odoo module classification (one-time, idempotent).
update public.crm_contacts
  set side = case when module in ('founder','investor') then module else null end
  where side is null and module in ('founder','investor');

-- Indexes for pipeline queries (classify queue, hot queue, segments).
create index if not exists idx_crm_contacts_side on public.crm_contacts (side);
create index if not exists idx_crm_contacts_segment on public.crm_contacts (segment);
create index if not exists idx_crm_contacts_email_lower on public.crm_contacts (lower(email));
create index if not exists idx_crm_contacts_prescore on public.crm_contacts (lead_prescore desc) where suppressed = false and converted = false;
