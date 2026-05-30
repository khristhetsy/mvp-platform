-- Founder-owned private investor CRM and controlled outreach (no external email send).

create table if not exists public.founder_investor_contacts (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  investor_name text not null,
  firm_name text,
  email text,
  phone text,
  website text,
  investor_type text,
  preferred_sectors text,
  preferred_stages text,
  check_size_min numeric(14, 2),
  check_size_max numeric(14, 2),
  geography text,
  source text not null default 'manual',
  tags text[] not null default '{}'::text[],
  notes text,
  status text not null default 'new' check (
    status in (
      'new', 'researching', 'selected', 'contacted', 'responded',
      'meeting_scheduled', 'not_interested', 'archived'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists founder_investor_contacts_email_unique_idx
  on public.founder_investor_contacts (founder_id, company_id, lower(email))
  where email is not null and trim(email) <> '';

create index if not exists founder_investor_contacts_founder_company_idx
  on public.founder_investor_contacts (founder_id, company_id);
create index if not exists founder_investor_contacts_status_idx
  on public.founder_investor_contacts (status);

create table if not exists public.founder_outreach_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.founder_investor_contacts(id) on delete set null,
  platform_investor_id uuid references public.profiles(id) on delete set null,
  match_score integer,
  status text not null default 'recommended' check (
    status in (
      'recommended', 'selected', 'intro_requested', 'contacted', 'responded',
      'meeting_scheduled', 'declined', 'archived'
    )
  ),
  source text not null default 'manual',
  notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_outreach_targets_founder_company_idx
  on public.founder_outreach_targets (founder_id, company_id);
create index if not exists founder_outreach_targets_status_idx
  on public.founder_outreach_targets (status);

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'active', 'paused', 'completed', 'canceled')),
  audience_count integer not null default 0,
  daily_limit integer not null default 25 check (daily_limit > 0 and daily_limit <= 25),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_campaigns_founder_idx on public.outreach_campaigns (founder_id);
create index if not exists outreach_campaigns_company_idx on public.outreach_campaigns (company_id);
create index if not exists outreach_campaigns_status_idx on public.outreach_campaigns (status);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  contact_id uuid not null references public.founder_investor_contacts(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (
    status in ('draft', 'queued', 'sent', 'replied', 'bounced', 'canceled')
  ),
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists outreach_messages_campaign_id_idx on public.outreach_messages (campaign_id);
create index if not exists outreach_messages_contact_id_idx on public.outreach_messages (contact_id);
create index if not exists outreach_messages_status_idx on public.outreach_messages (status);

alter table public.founder_investor_contacts enable row level security;
alter table public.founder_outreach_targets enable row level security;
alter table public.outreach_campaigns enable row level security;
alter table public.outreach_messages enable row level security;

-- founder_investor_contacts
drop policy if exists "founder_investor_contacts_select_own" on public.founder_investor_contacts;
create policy "founder_investor_contacts_select_own"
  on public.founder_investor_contacts for select to authenticated
  using (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "founder_investor_contacts_insert_own" on public.founder_investor_contacts;
create policy "founder_investor_contacts_insert_own"
  on public.founder_investor_contacts for insert to authenticated
  with check (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "founder_investor_contacts_update_own" on public.founder_investor_contacts;
create policy "founder_investor_contacts_update_own"
  on public.founder_investor_contacts for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "founder_investor_contacts_delete_own" on public.founder_investor_contacts;
create policy "founder_investor_contacts_delete_own"
  on public.founder_investor_contacts for delete to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_investor_contacts_select_staff" on public.founder_investor_contacts;
create policy "founder_investor_contacts_select_staff"
  on public.founder_investor_contacts for select to authenticated
  using (public.is_staff());

-- founder_outreach_targets
drop policy if exists "founder_outreach_targets_select_own" on public.founder_outreach_targets;
create policy "founder_outreach_targets_select_own"
  on public.founder_outreach_targets for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_outreach_targets_insert_own" on public.founder_outreach_targets;
create policy "founder_outreach_targets_insert_own"
  on public.founder_outreach_targets for insert to authenticated
  with check (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "founder_outreach_targets_update_own" on public.founder_outreach_targets;
create policy "founder_outreach_targets_update_own"
  on public.founder_outreach_targets for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "founder_outreach_targets_delete_own" on public.founder_outreach_targets;
create policy "founder_outreach_targets_delete_own"
  on public.founder_outreach_targets for delete to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_outreach_targets_select_staff" on public.founder_outreach_targets;
create policy "founder_outreach_targets_select_staff"
  on public.founder_outreach_targets for select to authenticated
  using (public.is_staff());

-- outreach_campaigns
drop policy if exists "outreach_campaigns_select_own" on public.outreach_campaigns;
create policy "outreach_campaigns_select_own"
  on public.outreach_campaigns for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "outreach_campaigns_insert_own" on public.outreach_campaigns;
create policy "outreach_campaigns_insert_own"
  on public.outreach_campaigns for insert to authenticated
  with check (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "outreach_campaigns_update_own" on public.outreach_campaigns;
create policy "outreach_campaigns_update_own"
  on public.outreach_campaigns for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "outreach_campaigns_select_staff" on public.outreach_campaigns;
create policy "outreach_campaigns_select_staff"
  on public.outreach_campaigns for select to authenticated
  using (public.is_staff());

-- outreach_messages via campaign ownership
drop policy if exists "outreach_messages_select_own" on public.outreach_messages;
create policy "outreach_messages_select_own"
  on public.outreach_messages for select to authenticated
  using (
    exists (
      select 1 from public.outreach_campaigns oc
      where oc.id = campaign_id and oc.founder_id = auth.uid()
    )
  );

drop policy if exists "outreach_messages_insert_own" on public.outreach_messages;
create policy "outreach_messages_insert_own"
  on public.outreach_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.outreach_campaigns oc
      where oc.id = campaign_id and oc.founder_id = auth.uid()
    )
  );

drop policy if exists "outreach_messages_update_own" on public.outreach_messages;
create policy "outreach_messages_update_own"
  on public.outreach_messages for update to authenticated
  using (
    exists (
      select 1 from public.outreach_campaigns oc
      where oc.id = campaign_id and oc.founder_id = auth.uid()
    )
  );

drop policy if exists "outreach_messages_select_staff" on public.outreach_messages;
create policy "outreach_messages_select_staff"
  on public.outreach_messages for select to authenticated
  using (public.is_staff());
