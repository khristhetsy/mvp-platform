-- Data-room Q&A: investors ask questions about a company's data room (optionally
-- about a specific document); the founder answers. Company-scoped.
--
-- Access is enforced in app code (service-role reads/writes with explicit
-- company/investor filters, mirroring data-room activity + access). RLS below is
-- defense-in-depth for any direct client access.
--
-- Additive and idempotent — safe to apply on staging first, then production.

create table if not exists public.data_room_questions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  question    text not null check (char_length(question) between 1 and 2000),
  answer      text check (char_length(answer) <= 4000),
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists drq_company_idx  on public.data_room_questions (company_id);
create index if not exists drq_investor_idx on public.data_room_questions (investor_id);
create index if not exists drq_document_idx on public.data_room_questions (document_id);

comment on table public.data_room_questions is
  'Investor→founder Q&A on a company data room. Investor inserts; founder answers.';

alter table public.data_room_questions enable row level security;

-- staff: full access (support + moderation)
drop policy if exists drq_staff_all on public.data_room_questions;
create policy drq_staff_all on public.data_room_questions
  for all using (public.is_staff()) with check (public.is_staff());

-- investor: insert + read their own questions
drop policy if exists drq_investor_insert on public.data_room_questions;
create policy drq_investor_insert on public.data_room_questions
  for insert with check (investor_id = auth.uid());

drop policy if exists drq_investor_read on public.data_room_questions;
create policy drq_investor_read on public.data_room_questions
  for select using (investor_id = auth.uid());

-- founder: read + answer (update) questions for companies they own
drop policy if exists drq_founder_read on public.data_room_questions;
create policy drq_founder_read on public.data_room_questions
  for select using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
  );

drop policy if exists drq_founder_update on public.data_room_questions;
create policy drq_founder_update on public.data_room_questions
  for update using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
  );
