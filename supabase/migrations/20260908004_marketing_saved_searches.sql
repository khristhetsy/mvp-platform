-- Saved searches for the Marketing Contacts grid (Odoo-style Favorites). Each row
-- captures a filter spec + group-by + visible columns. Private to the owner unless
-- is_shared; is_default marks the owner's auto-applied search. Service-role only in
-- practice (staff endpoints), so RLS stays simple.

create table if not exists public.marketing_saved_searches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  name       text not null,
  spec       jsonb not null default '{"match":"all","conditions":[]}'::jsonb,
  group_by   text,
  columns    text[],
  is_default boolean not null default false,
  is_shared  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_saved_searches_owner_idx
  on public.marketing_saved_searches (owner_id);

alter table public.marketing_saved_searches enable row level security;
