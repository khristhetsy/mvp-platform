-- Hybrid CRM automation (Nov 14, 2026).
-- Editable rules per pipeline stage, a log of the events that fire them, and the
-- approvals a person answers on the opportunity page. Service role only: RLS is
-- on with no policies, so no browser client can read or write these tables. Every
-- access goes through the admin sales API routes and the automation engine.

create table if not exists public.sales_automation_rules (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.sales_stages(id) on delete cascade,
  name text not null,
  action text not null default 'move' check (action in ('create', 'move')),
  triggers text[] not null default '{}',
  match_mode text not null default 'any' check (match_mode in ('any', 'all')),
  mode text not null default 'ask' check (mode in ('ask', 'auto')),
  wait_days int not null default 0 check (wait_days >= 0 and wait_days <= 90),
  from_stage_ids uuid[] not null default '{}',
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_automation_rules_stage_idx on public.sales_automation_rules (stage_id);

create table if not exists public.sales_automation_events (
  id uuid primary key default gen_random_uuid(),
  contact_crm_id uuid references public.crm_contacts(id) on delete cascade,
  email text,
  trigger text not null,
  created_at timestamptz not null default now()
);
create index if not exists sales_automation_events_contact_idx on public.sales_automation_events (contact_crm_id, trigger, created_at desc);

create table if not exists public.sales_automation_approvals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  rule_id uuid references public.sales_automation_rules(id) on delete set null,
  from_stage_id uuid references public.sales_stages(id) on delete set null,
  to_stage_id uuid not null references public.sales_stages(id) on delete cascade,
  trigger text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'kept', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
-- One open suggestion per opportunity and target stage.
create unique index if not exists sales_automation_approvals_pending_uidx
  on public.sales_automation_approvals (opportunity_id, to_stage_id) where status = 'pending';
create index if not exists sales_automation_approvals_opp_idx on public.sales_automation_approvals (opportunity_id, status);

alter table public.sales_automation_rules enable row level security;
alter table public.sales_automation_events enable row level security;
alter table public.sales_automation_approvals enable row level security;

-- Starter rules, matched to the default pipeline by stage name. Stages that do not
-- exist under these names are skipped; rules can be added and edited in the app.
do $$
declare
  pid uuid;
  s_new uuid; s_qual uuid; s_meet uuid; s_prop uuid; s_neg uuid; s_won uuid;
begin
  if exists (select 1 from public.sales_automation_rules) then return; end if;
  select id into pid from public.sales_pipelines where is_default and not archived order by created_at limit 1;
  if pid is null then return; end if;
  select id into s_new  from public.sales_stages where pipeline_id = pid and lower(name) = 'new opportunity' limit 1;
  select id into s_qual from public.sales_stages where pipeline_id = pid and lower(name) like 'qualified%' limit 1;
  select id into s_meet from public.sales_stages where pipeline_id = pid and lower(name) = 'meeting' limit 1;
  select id into s_prop from public.sales_stages where pipeline_id = pid and lower(name) = 'proposal' limit 1;
  select id into s_neg  from public.sales_stages where pipeline_id = pid and lower(name) = 'negotiation' limit 1;
  select id into s_won  from public.sales_stages where pipeline_id = pid and is_won limit 1;

  if s_new is not null then
    insert into public.sales_automation_rules (stage_id, name, action, triggers, match_mode, mode, sort_order)
    values (s_new, 'Create an opportunity when a meeting is booked', 'create', array['meeting_scheduled'], 'any', 'auto', 1);
  end if;
  if s_meet is not null then
    insert into public.sales_automation_rules (stage_id, name, action, triggers, match_mode, mode, from_stage_ids, sort_order)
    values (s_meet, 'Suggest Meeting when a meeting is booked', 'move', array['meeting_scheduled'], 'any', 'ask',
            array_remove(array[s_new, s_qual], null), 2);
  end if;
  if s_prop is not null then
    insert into public.sales_automation_rules (stage_id, name, action, triggers, match_mode, mode, from_stage_ids, sort_order)
    values (s_prop, 'Suggest Proposal when a proposal or signup invite is sent', 'move', array['proposal_sent', 'invite_sent'], 'any', 'ask',
            array_remove(array[s_meet], null), 3);
  end if;
  if s_won is not null then
    insert into public.sales_automation_rules (stage_id, name, action, triggers, match_mode, mode, from_stage_ids, sort_order)
    values (s_won, 'Suggest Won when they sign up and pay', 'move', array['signed_up', 'payment_received'], 'all', 'ask',
            array_remove(array[s_prop, s_neg], null), 4);
  end if;
  if s_neg is not null then
    insert into public.sales_automation_rules (stage_id, name, action, triggers, match_mode, mode, wait_days, from_stage_ids, sort_order)
    values (s_neg, 'Suggest Negotiation when they signed up but have not paid', 'move', array['signed_up_unpaid'], 'any', 'ask', 3,
            array_remove(array[s_prop], null), 5);
  end if;
end $$;
