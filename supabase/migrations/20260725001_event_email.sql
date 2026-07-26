-- Event Email Wizard (Event Hub → Event Template). Additive only; no changes to
-- existing Marketing Hub semantics. REVIEW BEFORE APPLYING (per build spec §4).
-- Targets the real marketing tables in this repo: marketing_templates / marketing_campaigns.

-- 4.1 Template category (event templates live in the existing library).
alter table public.marketing_templates
  add column if not exists category text not null default 'general'
  check (category in ('general','event'));

-- 4.2 Link a campaign to an event (nullable — general campaigns unaffected).
alter table public.marketing_campaigns
  add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.marketing_campaigns
  add column if not exists event_email_type text
  check (event_email_type in ('invite','reminder','day_of'));

-- 4.3 Snapshot of merged data frozen at send time (events can be edited later).
alter table public.marketing_campaigns
  add column if not exists merge_snapshot jsonb;

-- New columns inherit the existing marketing_campaigns / marketing_templates RLS
-- (staff-write). No new tables. "Past registrants" is a dynamic resolver over the
-- existing event registrations table, run server-side only (counts to the client).
