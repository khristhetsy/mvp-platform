-- Enable RLS on diligence_reports
-- AI-generated diligence reports were previously readable by any authenticated
-- user via the anon key. Restrict to company members and staff only.
alter table public.diligence_reports enable row level security;

create policy "diligence_reports_company_member_select"
  on public.diligence_reports for select
  using (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'analyst')
    )
  );

create policy "diligence_reports_staff_all"
  on public.diligence_reports for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'analyst')
    )
  );

-- Enable RLS on campaigns (original fundraising campaigns table)
-- This table stores company fundraising slugs and investor interest data.
alter table public.campaigns enable row level security;

create policy "campaigns_company_member_select"
  on public.campaigns for select
  using (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'analyst')
    )
  );

create policy "campaigns_founder_write"
  on public.campaigns for all
  using (
    company_id in (
      select company_id from public.company_members
      where user_id = auth.uid() and role = 'founder'
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'analyst')
    )
  );
