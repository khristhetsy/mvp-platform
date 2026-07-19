-- Approval-gated investor outreach. AI drafts a campaign from a strong match;
-- an ADMIN must approve before anything queues; a weekly job sends up to the cap
-- and stops if paused. Live email dispatch is additionally gated by the
-- INVESTOR_OUTREACH_LIVE env flag in code, pending counsel-approved copy.

create table if not exists public.investor_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'pending_approval',   -- pending_approval | approved | paused | completed
  template_key text not null default 'intro_fit_v1',
  weekly_cap integer not null default 10 check (weekly_cap between 5 and 20),
  paused boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create table if not exists public.investor_outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.investor_outreach_campaigns(id) on delete cascade,
  investor_ref text not null,          -- investor_profiles.profile_id or 'prospect:<id>'
  investor_name text not null,
  match_score integer not null default 0,
  status text not null default 'queued',  -- queued | sent | skipped
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, investor_ref)
);

create index if not exists investor_outreach_recipients_campaign_idx
  on public.investor_outreach_recipients (campaign_id, status);

alter table public.investor_outreach_campaigns enable row level security;
alter table public.investor_outreach_recipients enable row level security;

-- Staff (admin/analyst) manage everything.
drop policy if exists "staff_manage_outreach_campaigns" on public.investor_outreach_campaigns;
create policy "staff_manage_outreach_campaigns" on public.investor_outreach_campaigns
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

drop policy if exists "staff_manage_outreach_recipients" on public.investor_outreach_recipients;
create policy "staff_manage_outreach_recipients" on public.investor_outreach_recipients
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

-- Founders may READ their own company's campaign + send log (visibility, not control).
drop policy if exists "founder_read_own_outreach_campaign" on public.investor_outreach_campaigns;
create policy "founder_read_own_outreach_campaign" on public.investor_outreach_campaigns
  for select to authenticated
  using (exists (select 1 from public.companies c where c.id = investor_outreach_campaigns.company_id and c.founder_id = auth.uid()));

drop policy if exists "founder_read_own_outreach_recipients" on public.investor_outreach_recipients;
create policy "founder_read_own_outreach_recipients" on public.investor_outreach_recipients
  for select to authenticated
  using (exists (
    select 1 from public.investor_outreach_campaigns oc
    join public.companies c on c.id = oc.company_id
    where oc.id = investor_outreach_recipients.campaign_id and c.founder_id = auth.uid()
  ));
