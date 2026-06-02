-- Phase 1: Deal Room foundation for structured investor-founder diligence collaboration.
-- Additive only. Does not replace messaging or collaboration systems.

create table if not exists public.deal_rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  investor_profile_id uuid not null references public.investor_profiles(id) on delete cascade,
  investor_user_id uuid not null references public.profiles(id) on delete cascade,
  spv_id uuid references public.spv_opportunities(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'pending' check (status in ('active','pending','archived','closed')),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, investor_profile_id)
);

create index if not exists deal_rooms_company_idx on public.deal_rooms (company_id, created_at desc);
create index if not exists deal_rooms_founder_idx on public.deal_rooms (founder_id, created_at desc);
create index if not exists deal_rooms_investor_idx on public.deal_rooms (investor_user_id, created_at desc);
create index if not exists deal_rooms_status_idx on public.deal_rooms (status, created_at desc);

create table if not exists public.deal_room_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  asked_by_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other' check (
    category in ('financial','legal','traction','market','product','team','compliance','operations','other')
  ),
  question text not null check (char_length(question) >= 1 and char_length(question) <= 6000),
  status text not null default 'open' check (status in ('open','resolved','clarification_requested')),
  founder_response text,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_room_questions_room_idx on public.deal_room_questions (room_id, created_at desc);
create index if not exists deal_room_questions_status_idx on public.deal_room_questions (room_id, status, created_at desc);

create table if not exists public.deal_room_document_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (
    request_type in ('financials','cap_table','legal_docs','customer_metrics','custom')
  ),
  custom_request text,
  status text not null default 'open' check (status in ('open','fulfilled','clarification_requested','cancelled')),
  founder_note text,
  fulfilled_document_id uuid references public.documents(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_room_doc_requests_room_idx on public.deal_room_document_requests (room_id, created_at desc);
create index if not exists deal_room_doc_requests_status_idx on public.deal_room_document_requests (room_id, status, created_at desc);

create table if not exists public.deal_room_activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deal_room_activity_room_idx on public.deal_room_activity_events (room_id, created_at desc);

alter table public.deal_rooms enable row level security;
alter table public.deal_room_questions enable row level security;
alter table public.deal_room_document_requests enable row level security;
alter table public.deal_room_activity_events enable row level security;

-- Deal room visibility
drop policy if exists "deal_rooms_select_participants" on public.deal_rooms;
create policy "deal_rooms_select_participants"
  on public.deal_rooms for select to authenticated
  using (
    public.is_staff()
    or founder_id = auth.uid()
    or investor_user_id = auth.uid()
  );

drop policy if exists "deal_rooms_insert_staff" on public.deal_rooms;
create policy "deal_rooms_insert_staff"
  on public.deal_rooms for insert to authenticated
  with check (public.is_staff());

drop policy if exists "deal_rooms_update_staff" on public.deal_rooms;
create policy "deal_rooms_update_staff"
  on public.deal_rooms for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Questions: participants can read; investor can create; founder can respond/update.
drop policy if exists "deal_room_questions_select_participants" on public.deal_room_questions;
create policy "deal_room_questions_select_participants"
  on public.deal_room_questions for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and (r.founder_id = auth.uid() or r.investor_user_id = auth.uid())
    )
  );

drop policy if exists "deal_room_questions_insert_investor" on public.deal_room_questions;
create policy "deal_room_questions_insert_investor"
  on public.deal_room_questions for insert to authenticated
  with check (
    asked_by_user_id = auth.uid()
    and exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.investor_user_id = auth.uid() and r.status = 'active'
    )
  );

drop policy if exists "deal_room_questions_update_founder" on public.deal_room_questions;
create policy "deal_room_questions_update_founder"
  on public.deal_room_questions for update to authenticated
  using (
    exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.founder_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.founder_id = auth.uid()
    )
  );

-- Document requests: participants can read; investor can create; founder can fulfill/update.
drop policy if exists "deal_room_doc_requests_select_participants" on public.deal_room_document_requests;
create policy "deal_room_doc_requests_select_participants"
  on public.deal_room_document_requests for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and (r.founder_id = auth.uid() or r.investor_user_id = auth.uid())
    )
  );

drop policy if exists "deal_room_doc_requests_insert_investor" on public.deal_room_document_requests;
create policy "deal_room_doc_requests_insert_investor"
  on public.deal_room_document_requests for insert to authenticated
  with check (
    requested_by_user_id = auth.uid()
    and exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.investor_user_id = auth.uid() and r.status = 'active'
    )
  );

drop policy if exists "deal_room_doc_requests_update_founder" on public.deal_room_document_requests;
create policy "deal_room_doc_requests_update_founder"
  on public.deal_room_document_requests for update to authenticated
  using (
    exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.founder_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and r.founder_id = auth.uid()
    )
  );

-- Activity events: participants can read; staff-only writes (server-side service role).
drop policy if exists "deal_room_activity_select_participants" on public.deal_room_activity_events;
create policy "deal_room_activity_select_participants"
  on public.deal_room_activity_events for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.deal_rooms r
      where r.id = room_id and (r.founder_id = auth.uid() or r.investor_user_id = auth.uid())
    )
  );

drop policy if exists "deal_room_activity_insert_staff" on public.deal_room_activity_events;
create policy "deal_room_activity_insert_staff"
  on public.deal_room_activity_events for insert to authenticated
  with check (public.is_staff());

