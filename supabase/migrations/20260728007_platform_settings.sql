create table if not exists platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

create policy platform_settings_service_all
  on platform_settings for all
  to service_role
  using (true)
  with check (true);
