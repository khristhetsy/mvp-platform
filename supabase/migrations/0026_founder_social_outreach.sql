-- Founder social outreach drafts (no external posting APIs).

alter table public.founder_investor_contacts
  add column if not exists linkedin_url text,
  add column if not exists twitter_url text,
  add column if not exists crunchbase_url text,
  add column if not exists personal_website_url text,
  add column if not exists other_social_url text;

create table if not exists public.social_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  draft_type text not null check (
    draft_type in (
      'linkedin_campaign_announcement',
      'investor_update',
      'readiness_milestone',
      'traction_update',
      'fundraising_update',
      'thought_leadership',
      'follow_up_post'
    )
  ),
  platform text not null default 'linkedin' check (platform in ('linkedin', 'x_twitter', 'general')),
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'copied', 'archived')),
  compliance_status text not null default 'needs_review' check (
    compliance_status in ('needs_review', 'approved', 'flagged')
  ),
  copied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_outreach_drafts_founder_company_idx
  on public.social_outreach_drafts (founder_id, company_id);
create index if not exists social_outreach_drafts_status_idx on public.social_outreach_drafts (status);
create index if not exists social_outreach_drafts_compliance_idx
  on public.social_outreach_drafts (compliance_status);

alter table public.social_outreach_drafts enable row level security;

drop policy if exists "social_outreach_drafts_select_own" on public.social_outreach_drafts;
create policy "social_outreach_drafts_select_own"
  on public.social_outreach_drafts for select to authenticated
  using (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "social_outreach_drafts_insert_own" on public.social_outreach_drafts;
create policy "social_outreach_drafts_insert_own"
  on public.social_outreach_drafts for insert to authenticated
  with check (
    founder_id = auth.uid()
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "social_outreach_drafts_update_own" on public.social_outreach_drafts;
create policy "social_outreach_drafts_update_own"
  on public.social_outreach_drafts for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "social_outreach_drafts_delete_own" on public.social_outreach_drafts;
create policy "social_outreach_drafts_delete_own"
  on public.social_outreach_drafts for delete to authenticated
  using (founder_id = auth.uid());

drop policy if exists "social_outreach_drafts_select_staff" on public.social_outreach_drafts;
create policy "social_outreach_drafts_select_staff"
  on public.social_outreach_drafts for select to authenticated
  using (public.is_staff());
