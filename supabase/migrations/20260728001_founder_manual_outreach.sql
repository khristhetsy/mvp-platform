create table if not exists public.founder_manual_outreach (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'draft',
  email_subject text,
  email_body text,
  sequence jsonb not null default '[]'::jsonb,
  recipient_ids jsonb not null default '[]'::jsonb,
  stop_on_reply boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

alter table public.founder_manual_outreach enable row level security;

drop policy if exists "founder_rw_manual_outreach" on public.founder_manual_outreach;
create policy "founder_rw_manual_outreach" on public.founder_manual_outreach
  for all to authenticated
  using (exists (select 1 from public.companies c where c.id = founder_manual_outreach.company_id and c.founder_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = founder_manual_outreach.company_id and c.founder_id = auth.uid()));
