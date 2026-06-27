-- Migration: 20260627008_business_plans.sql
-- Founder AI Business Plan generator (Stage 2 / "qualify" gated). One plan per
-- company. Sections + assumptions are the founder's working draft; the finished
-- plan is also rendered to a BUSINESS_PLAN document (which counts toward readiness).
-- Private/authenticated — never exposed on public surfaces.

create table if not exists public.business_plans (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  sections       jsonb not null default '{}'::jsonb,
  assumptions    jsonb not null default '{}'::jsonb,
  projections    jsonb,
  exec_summary   text,
  status         text not null default 'draft' check (status in ('draft','finalized')),
  ai_assisted    boolean not null default false,
  last_edited_by uuid references public.profiles(id) on delete set null,
  generated_at   timestamptz,
  finalized_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id)
);

drop trigger if exists business_plans_touch on public.business_plans;
create trigger business_plans_touch before update on public.business_plans
  for each row execute function public.touch_updated_at();

alter table public.business_plans enable row level security;

-- Founder (company owner/member) manages their own plan.
drop policy if exists business_plans_owner_all on public.business_plans;
create policy business_plans_owner_all on public.business_plans
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  );

-- Staff can read every plan (for the admin company workspace).
drop policy if exists business_plans_staff_read on public.business_plans;
create policy business_plans_staff_read on public.business_plans
  for select using (public.is_staff());
