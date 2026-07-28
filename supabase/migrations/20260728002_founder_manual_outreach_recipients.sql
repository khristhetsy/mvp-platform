create table if not exists public.founder_manual_outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null references public.founder_investor_contacts(id) on delete cascade,
  email text not null,
  name text,
  next_step_index integer not null default 0,
  status text not null default 'active',
  last_sent_at timestamptz,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, contact_id)
);

create index if not exists founder_manual_outreach_recipients_company_idx
  on public.founder_manual_outreach_recipients (company_id, status);

alter table public.founder_manual_outreach_recipients enable row level security;

drop policy if exists "founder_read_manual_recipients" on public.founder_manual_outreach_recipients;
create policy "founder_read_manual_recipients" on public.founder_manual_outreach_recipients
  for select to authenticated
  using (exists (select 1 from public.companies c where c.id = founder_manual_outreach_recipients.company_id and c.founder_id = auth.uid()));
