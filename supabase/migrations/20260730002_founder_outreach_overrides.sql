-- Per-founder outreach qualification overrides. Each row holds ONLY the sections
-- a founder has customized (match rules, automation cap/schedule/pause, message);
-- everything else resolves from the global platform_settings defaults at read time.

create table if not exists public.founder_outreach_overrides (
  company_id  uuid primary key references public.companies(id) on delete cascade,
  overrides   jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.founder_outreach_overrides enable row level security;

drop policy if exists "staff_rw_founder_outreach_overrides" on public.founder_outreach_overrides;
create policy "staff_rw_founder_outreach_overrides" on public.founder_outreach_overrides
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
