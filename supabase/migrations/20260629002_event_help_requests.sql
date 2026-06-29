-- ============================================================
-- Event help desk: attendees can ask for a human; staff resolve
-- from the Live Control Center. The vFairs "Help & Info Desk".
-- ============================================================

create table if not exists public.event_help_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists event_help_requests_open_idx
  on public.event_help_requests(event_id, status, created_at desc);

alter table public.event_help_requests enable row level security;

-- Attendees may file a request for themselves.
create policy event_help_requests_insert_own on public.event_help_requests
  for insert with check (profile_id = auth.uid());

-- Requesters can see their own; staff can see and resolve all.
create policy event_help_requests_select_own on public.event_help_requests
  for select using (profile_id = auth.uid());

create policy event_help_requests_staff_all on public.event_help_requests
  for all using (public.is_staff()) with check (public.is_staff());
