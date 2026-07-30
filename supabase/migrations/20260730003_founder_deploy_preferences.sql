-- Per-founder Deploy settings: notification toggles + a do-not-contact suppression
-- list. The do-not-contact entries (emails or domains) are excluded from this
-- founder's automated and manual sends in addition to the global unsubscribe list.

create table if not exists public.founder_deploy_preferences (
  company_id     uuid primary key references public.companies(id) on delete cascade,
  prefs          jsonb not null default '{}'::jsonb,
  do_not_contact text[] not null default '{}',
  updated_at     timestamptz not null default now()
);

alter table public.founder_deploy_preferences enable row level security;

drop policy if exists "founder_rw_deploy_preferences" on public.founder_deploy_preferences;
create policy "founder_rw_deploy_preferences" on public.founder_deploy_preferences
  for all
  using (exists (select 1 from public.companies c where c.id = founder_deploy_preferences.company_id and c.founder_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = founder_deploy_preferences.company_id and c.founder_id = auth.uid()));

drop policy if exists "staff_read_deploy_preferences" on public.founder_deploy_preferences;
create policy "staff_read_deploy_preferences" on public.founder_deploy_preferences
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
