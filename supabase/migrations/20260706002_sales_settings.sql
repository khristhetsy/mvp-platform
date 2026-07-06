-- Sales Hub settings — task types + reminder/notification preferences.
-- Single row; service-role only (RLS on, no policy).

create table if not exists public.sales_settings (
  id text primary key default 'default',
  task_types text[] not null default array['Call','Email','Demo','Follow-up','Proposal'],
  remind_task_due boolean not null default true,
  remind_stalled boolean not null default true,
  stalled_days int not null default 14,
  updated_at timestamptz not null default now()
);

insert into public.sales_settings (id) values ('default') on conflict (id) do nothing;

alter table public.sales_settings enable row level security;
