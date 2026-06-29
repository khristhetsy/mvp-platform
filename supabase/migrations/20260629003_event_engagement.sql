-- ============================================================
-- Engagement & moderation levers: mute, ban, live polls.
-- Bonus points reuse the existing event_points ledger (action = 'bonus').
-- ============================================================

-- ── Mute (Networking Lounge chat) ────────────────────────────────────────────
create table if not exists public.event_muted_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  muted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_muted_attendees enable row level security;

create policy event_muted_staff_all on public.event_muted_attendees
  for all using (public.is_staff()) with check (public.is_staff());

create policy event_muted_select_own on public.event_muted_attendees
  for select using (profile_id = auth.uid());

-- Enforce mute server-side: a muted attendee cannot insert lounge messages.
create policy lounge_messages_not_muted on public.lounge_messages
  as restrictive for insert
  with check (
    not exists (
      select 1 from public.event_muted_attendees m
      where m.event_id = event_id and m.profile_id = auth.uid()
    )
  );

-- ── Ban (block re-entry) ─────────────────────────────────────────────────────
create table if not exists public.event_banned_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permanent boolean not null default false,
  banned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_banned_attendees enable row level security;

create policy event_banned_staff_all on public.event_banned_attendees
  for all using (public.is_staff()) with check (public.is_staff());

create policy event_banned_select_own on public.event_banned_attendees
  for select using (profile_id = auth.uid());

-- ── Live polls ───────────────────────────────────────────────────────────────
create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  is_open boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists event_polls_event_idx on public.event_polls(event_id, is_open, created_at desc);
alter table public.event_polls enable row level security;

create policy event_polls_staff_all on public.event_polls
  for all using (public.is_staff()) with check (public.is_staff());

create policy event_polls_auth_read on public.event_polls
  for select using (auth.uid() is not null);

create table if not exists public.event_poll_votes (
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, profile_id)
);
alter table public.event_poll_votes enable row level security;

create policy event_poll_votes_insert_own on public.event_poll_votes
  for insert with check (profile_id = auth.uid());

create policy event_poll_votes_select_own on public.event_poll_votes
  for select using (profile_id = auth.uid());

create policy event_poll_votes_staff_all on public.event_poll_votes
  for all using (public.is_staff()) with check (public.is_staff());
