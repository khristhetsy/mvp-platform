-- ============================================================
-- Event-scoped room moderators + moderation audit log
-- Layers on top of platform RBAC: a staff member can be scoped to
-- specific rooms for a single event. rooms = array of room names,
-- or ['*'] for all rooms. Every control-room action is audited.
-- ============================================================

create table if not exists public.event_moderators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rooms text[] not null default '{}',
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_moderators_event_idx on public.event_moderators(event_id);

alter table public.event_moderators enable row level security;

create policy event_moderators_staff_all on public.event_moderators
  for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.event_moderation_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_moderation_log_event_idx
  on public.event_moderation_log(event_id, created_at desc);

alter table public.event_moderation_log enable row level security;

create policy event_moderation_log_staff_all on public.event_moderation_log
  for all using (public.is_staff()) with check (public.is_staff());
