-- Founder support: a per-company support thread so staff and founders talk in one
-- place tied to the company, plus a queue staff triage from. Additive +
-- idempotent. Apply on staging, verify, then production.

create table if not exists public.support_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  founder_id    uuid not null references public.profiles(id) on delete cascade,
  subject       text not null,
  context_stage text,               -- engine slug the request came from (qualify, deploy, …)
  context_item  text,               -- founder-menu item label, when raised from one
  source        text not null default 'request_help'
    check (source in ('request_help', 'question', 'manual')),
  status        text not null default 'open'
    check (status in ('open', 'pending_founder', 'resolved')),
  assigned_to   uuid references public.profiles(id) on delete set null,
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  csat          smallint check (csat in (-1, 1)),   -- founder rating: thumbs down / up
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists support_requests_status_idx on public.support_requests (status, created_at desc);
create index if not exists support_requests_company_idx on public.support_requests (company_id, created_at desc);
create index if not exists support_requests_assigned_idx on public.support_requests (assigned_to, created_at desc);
create index if not exists support_requests_founder_idx on public.support_requests (founder_id, created_at desc);

create table if not exists public.support_messages (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.support_requests(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  author_role    text not null check (author_role in ('founder', 'staff')),
  body           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists support_messages_request_idx on public.support_messages (request_id, created_at);

alter table public.support_requests enable row level security;
alter table public.support_messages enable row level security;

-- Requests: a founder owns their own; staff see and manage all.
drop policy if exists support_requests_founder_all on public.support_requests;
create policy support_requests_founder_all on public.support_requests
  for all using (founder_id = auth.uid()) with check (founder_id = auth.uid());

drop policy if exists support_requests_staff_read on public.support_requests;
create policy support_requests_staff_read on public.support_requests
  for select using (public.is_staff());

drop policy if exists support_requests_staff_write on public.support_requests;
create policy support_requests_staff_write on public.support_requests
  for update using (public.is_staff()) with check (public.is_staff());

-- Messages: participants (the request's founder or any staff) can read; the
-- founder can post on their own request; staff can post on any.
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select using (
    public.is_staff()
    or exists (select 1 from public.support_requests r where r.id = request_id and r.founder_id = auth.uid())
  );

drop policy if exists support_messages_insert_founder on public.support_messages;
create policy support_messages_insert_founder on public.support_messages
  for insert with check (
    author_user_id = auth.uid()
    and author_role = 'founder'
    and exists (select 1 from public.support_requests r where r.id = request_id and r.founder_id = auth.uid())
  );

drop policy if exists support_messages_insert_staff on public.support_messages;
create policy support_messages_insert_staff on public.support_messages
  for insert with check (
    author_user_id = auth.uid() and author_role = 'staff' and public.is_staff()
  );
