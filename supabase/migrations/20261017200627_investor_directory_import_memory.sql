create table if not exists public.investor_directory_import_memory (
  profile_id uuid not null,
  header_key text not null,
  fields text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (profile_id, header_key)
);
alter table public.investor_directory_import_memory enable row level security;
comment on table public.investor_directory_import_memory is 'Admin directory import: the field choices an admin confirmed per column header, reused on the next import. Service role only.';
