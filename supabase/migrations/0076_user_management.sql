-- Add is_active and last_seen_at to profiles for user management
alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz;

-- Index for fast role/status filtering
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
