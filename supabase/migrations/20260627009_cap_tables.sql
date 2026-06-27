-- Migration: 20260627009_cap_tables.sql
-- Founder cap table tool (Stage 2 / "qualify" gated). One cap table per company.
-- holders = ordered list of shareholders (founders, option pool, investors);
-- round  = an optional modeled financing round (new investment + pre-money).
-- The exported file is also saved as a CAP_TABLE document (counts toward
-- readiness and satisfies the Qualify document requirement). Private/authenticated.

create table if not exists public.cap_tables (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  holders        jsonb not null default '[]'::jsonb,
  round          jsonb,
  last_edited_by uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id)
);

drop trigger if exists cap_tables_touch on public.cap_tables;
create trigger cap_tables_touch before update on public.cap_tables
  for each row execute function public.touch_updated_at();

alter table public.cap_tables enable row level security;

-- Founder (company owner/member) manages their own cap table.
drop policy if exists cap_tables_owner_all on public.cap_tables;
create policy cap_tables_owner_all on public.cap_tables
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  );

-- Staff can read every cap table (for the admin company workspace).
drop policy if exists cap_tables_staff_read on public.cap_tables;
create policy cap_tables_staff_read on public.cap_tables
  for select using (public.is_staff());
