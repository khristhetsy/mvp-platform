-- Admin-controlled feature visibility for Founder/Investor workspaces. Additive.
-- Absence of a row = enabled (features default on). Admin writes via service role.

create table if not exists public.feature_flags (
  audience text not null check (audience in ('founder', 'investor')),
  feature text not null check (feature in ('inbox', 'calendar', 'scheduling')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (audience, feature)
);

alter table public.feature_flags enable row level security;

-- Any signed-in user may read flags (drives nav hiding); only service role writes.
drop policy if exists "feature_flags_read" on public.feature_flags;
create policy "feature_flags_read" on public.feature_flags for select to authenticated using (true);
