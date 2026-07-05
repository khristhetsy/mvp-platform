-- Operations Hub settings — single row of tunables for the escalation engine.
-- Service-role only (RLS on, no policy); all access via admin API.

create table if not exists public.ops_settings (
  id text primary key default 'default',
  onboarding_sla_days int not null default 7,
  diligence_sla_days int not null default 3,
  default_manager_id uuid references public.profiles(id) on delete set null,
  email_escalations boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.ops_settings (id) values ('default') on conflict (id) do nothing;

alter table public.ops_settings enable row level security;
