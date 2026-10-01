-- AI budget: monthly dollar budgets per category, a per-call spend log, and
-- deduped budget alerts. Additive only: no existing table is changed.
--
-- Every paid AI call (Claude, Serper) writes one ai_spend_events row with its
-- actual cost. Vapi call cost is already stored on call_attempts.cost, so the
-- status function reads it from there instead of copying it.
-- Months are calendar months in UTC.

create table if not exists public.ai_budgets (
  category    text primary key,
  monthly_usd numeric(10,2) not null check (monthly_usd >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- Starting budgets from the approved mockup (total $100). Editable in
-- Admin > Feature Controls > AI budget.
insert into public.ai_budgets (category, monthly_usd) values
  ('founder', 40), ('investor', 10), ('public', 12), ('internal', 15),
  ('scheduled', 8), ('enrichment', 5), ('voice', 10)
on conflict (category) do nothing;

create table if not exists public.ai_budget_settings (
  id          integer primary key default 1 check (id = 1),
  alert_email text not null,
  updated_at  timestamptz not null default now()
);
insert into public.ai_budget_settings (id, alert_email) values (1, 'kthetsy@myicfos.com')
on conflict (id) do nothing;

create table if not exists public.ai_spend_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  vendor        text not null check (vendor in ('anthropic', 'serper', 'vapi')),
  category      text not null,
  feature       text not null,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  units         integer,
  cost_usd      numeric(12,6) not null default 0,
  profile_id    uuid references public.profiles(id) on delete set null,
  path          text
);
create index if not exists ai_spend_events_month
  on public.ai_spend_events (created_at desc, category);

-- One row per (scope, month, threshold) so each alert email sends once.
create table if not exists public.ai_budget_alerts (
  scope      text not null,      -- a category key, or 'total'
  month      date not null,
  threshold  integer not null check (threshold in (80, 100)),
  sent_at    timestamptz not null default now(),
  primary key (scope, month, threshold)
);

alter table public.ai_budgets         enable row level security;
alter table public.ai_budget_settings enable row level security;
alter table public.ai_spend_events    enable row level security;
alter table public.ai_budget_alerts   enable row level security;

-- Month to date spend for one category (Vapi call cost included under voice).
create or replace function public.ai_spend_month(p_category text)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(cost_usd) from ai_spend_events
                   where category = p_category and created_at >= date_trunc('month', now())), 0)
       + case when p_category = 'voice' then
           coalesce((select sum(cost) from call_attempts
                     where cost is not null and created_at >= date_trunc('month', now())), 0)
         else 0 end;
$$;

-- Budget vs actual for every category, for the admin screen and alerts.
create or replace function public.ai_budget_status()
returns table (category text, monthly_usd numeric, spent_usd numeric, calls bigint)
language sql stable security definer set search_path = public as $$
  select b.category, b.monthly_usd, public.ai_spend_month(b.category),
         (select count(*) from ai_spend_events e
           where e.category = b.category and e.created_at >= date_trunc('month', now()))
         + case when b.category = 'voice' then
             (select count(*) from call_attempts c where c.cost is not null and c.created_at >= date_trunc('month', now()))
           else 0 end
  from ai_budgets b;
$$;

-- Month to date cost and call count per category and tool, for the drilldown.
create or replace function public.ai_spend_breakdown()
returns table (category text, feature text, calls bigint, cost_usd numeric)
language sql stable security definer set search_path = public as $$
  select e.category, e.feature, count(*), sum(e.cost_usd)
  from ai_spend_events e
  where e.created_at >= date_trunc('month', now())
  group by e.category, e.feature
  union all
  select 'voice', 'vapi_calls', count(*), coalesce(sum(c.cost), 0)
  from call_attempts c
  where c.cost is not null and c.created_at >= date_trunc('month', now())
  having count(*) > 0;
$$;

revoke all on function public.ai_spend_month(text) from public, anon, authenticated;
revoke all on function public.ai_spend_breakdown() from public, anon, authenticated;
grant execute on function public.ai_spend_breakdown() to service_role;
revoke all on function public.ai_budget_status() from public, anon, authenticated;
grant execute on function public.ai_spend_month(text) to service_role;
grant execute on function public.ai_budget_status() to service_role;
