-- Migration: 20261122100000_term_sheets.sql
-- Term sheet creator (founder, Stage 2 "qualify" gated). The creator fills in the three revised direct to
-- investor term sheet templates (Convertible Note, SAFE, Series A Preferred). Only the blanks are stored.
-- Also saves the founder's Round structure inputs, so a term sheet can pull from them.
-- Private and authenticated: never exposed on public surfaces.

create table if not exists public.round_structures (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inputs     jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

drop trigger if exists round_structures_touch on public.round_structures;
create trigger round_structures_touch before update on public.round_structures
  for each row execute function public.touch_updated_at();

alter table public.round_structures enable row level security;

drop policy if exists round_structures_owner_all on public.round_structures;
create policy round_structures_owner_all on public.round_structures
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  );

drop policy if exists round_structures_staff_read on public.round_structures;
create policy round_structures_staff_read on public.round_structures
  for select using (public.is_staff());

create table if not exists public.term_sheets (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references public.companies(id) on delete cascade,
  form_type                 text not null check (form_type in ('convertible_note','safe','series_a')),
  source                    text not null default 'scratch' check (source in ('round_structure','scratch','uploaded')),
  status                    text not null default 'draft' check (status in ('draft','finalized')),
  title                     text not null default '',
  values                    jsonb not null default '{}'::jsonb,
  linked_fields             jsonb not null default '{}'::jsonb,
  round_structure_snapshot  jsonb,
  round_structure_synced_at timestamptz,
  document_id               uuid,
  notice_acknowledged_at    timestamptz,
  last_edited_by            uuid references public.profiles(id) on delete set null,
  finalized_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists term_sheets_company_idx on public.term_sheets (company_id, updated_at desc);

drop trigger if exists term_sheets_touch on public.term_sheets;
create trigger term_sheets_touch before update on public.term_sheets
  for each row execute function public.touch_updated_at();

alter table public.term_sheets enable row level security;

-- Founder (company owner or member) manages their own term sheets.
drop policy if exists term_sheets_owner_all on public.term_sheets;
create policy term_sheets_owner_all on public.term_sheets
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  );

-- Staff can read every term sheet (for the admin company workspace). No investor access.
drop policy if exists term_sheets_staff_read on public.term_sheets;
create policy term_sheets_staff_read on public.term_sheets
  for select using (public.is_staff());
