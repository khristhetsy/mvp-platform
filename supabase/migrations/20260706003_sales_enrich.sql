-- Sales Hub enrichment — richer opportunities, a standalone tasks table,
-- and additional settings. All idempotent; service-role only (RLS on, no policy).

-- 1) Enrich opportunities with the fields carried over from the Odoo CRM.
alter table public.sales_opportunities add column if not exists probability int;
alter table public.sales_opportunities add column if not exists expected_close date;
alter table public.sales_opportunities add column if not exists priority int not null default 0;      -- 0..3 stars
alter table public.sales_opportunities add column if not exists tags text[] not null default array[]::text[];
alter table public.sales_opportunities add column if not exists source text;
alter table public.sales_opportunities add column if not exists lead_status text;
alter table public.sales_opportunities add column if not exists billing text not null default 'yearly';  -- 'yearly' | 'monthly'
alter table public.sales_opportunities add column if not exists contact_crm_id text;    -- link back to crm_contacts
alter table public.sales_opportunities add column if not exists last_activity_at timestamptz;

-- 2) Standalone sales tasks/activities (reuses no other engine; keyed to opps/contacts).
create table if not exists public.sales_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'Call',
  summary text,
  due_date date,
  status text not null default 'open' check (status in ('open','done','snoozed')),
  assignee_id uuid references public.profiles(id) on delete set null,
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  contact_crm_id text,
  contact_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists idx_sales_tasks_status on public.sales_tasks (status, due_date);
create index if not exists idx_sales_tasks_opp on public.sales_tasks (opportunity_id);
create index if not exists idx_sales_tasks_assignee on public.sales_tasks (assignee_id) where status = 'open';
alter table public.sales_tasks enable row level security;

-- 3) Extra settings — default task assignee + a close-date-passed reminder toggle.
alter table public.sales_settings add column if not exists default_assignee_id uuid references public.profiles(id) on delete set null;
alter table public.sales_settings add column if not exists remind_close_passed boolean not null default false;
