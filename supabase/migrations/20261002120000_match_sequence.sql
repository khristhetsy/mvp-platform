-- Match campaign follow up sequence (Match Sequence Addendum, Oct 2, 2026).
-- Additive only: new nullable columns and two new tables. Existing Match
-- campaigns and the generic marketing sequence engine are not touched.

-- Per founder sequence state on the existing campaign founder rows.
alter table public.match_campaign_founders
  add column if not exists cohort_key text,
  add column if not exists variant text,
  add column if not exists thread_message_id text,
  add column if not exists day0_match_count integer,
  add column if not exists followup_branch text,
  add column if not exists followup_step integer not null default 0,
  add column if not exists next_followup_at timestamptz,
  add column if not exists followup_status text,
  add column if not exists followup_stop_reason text,
  add column if not exists booked_at timestamptz,
  add column if not exists replied_at timestamptz;

alter table public.match_campaign_founders drop constraint if exists match_campaign_founders_variant_check;
alter table public.match_campaign_founders add constraint match_campaign_founders_variant_check
  check (variant is null or variant in ('single', 'sequence'));
alter table public.match_campaign_founders drop constraint if exists match_campaign_founders_followup_branch_check;
alter table public.match_campaign_founders add constraint match_campaign_founders_followup_branch_check
  check (followup_branch is null or followup_branch in ('a', 'b'));
alter table public.match_campaign_founders drop constraint if exists match_campaign_founders_followup_status_check;
alter table public.match_campaign_founders add constraint match_campaign_founders_followup_status_check
  check (followup_status is null or followup_status in ('active', 'stopped', 'completed'));

create index if not exists match_campaign_founders_followup_due_idx
  on public.match_campaign_founders (next_followup_at)
  where followup_status = 'active';

-- Which investor profiles a founder opened on their match page.
create table if not exists public.match_campaign_investor_views (
  id uuid primary key default gen_random_uuid(),
  campaign_founder_id uuid not null references public.match_campaign_founders(id) on delete cascade,
  match_id uuid not null references public.match_campaign_matches(id) on delete cascade,
  view_count integer not null default 1,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (campaign_founder_id, match_id)
);

alter table public.match_campaign_investor_views enable row level security;
drop policy if exists match_campaign_investor_views_staff on public.match_campaign_investor_views;
create policy match_campaign_investor_views_staff on public.match_campaign_investor_views
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- One row per follow up touch (email or call task), including test mode records.
create table if not exists public.match_campaign_followups (
  id uuid primary key default gen_random_uuid(),
  campaign_founder_id uuid not null references public.match_campaign_founders(id) on delete cascade,
  step_key text not null,
  channel text not null check (channel in ('email', 'call')),
  status text not null check (status in ('sent', 'dry_run', 'failed', 'skipped')),
  resend_id text,
  sales_task_id uuid references public.sales_tasks(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign_founder_id, step_key)
);

create index if not exists match_campaign_followups_founder_idx on public.match_campaign_followups (campaign_founder_id);

alter table public.match_campaign_followups enable row level security;
drop policy if exists match_campaign_followups_staff on public.match_campaign_followups;
create policy match_campaign_followups_staff on public.match_campaign_followups
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
