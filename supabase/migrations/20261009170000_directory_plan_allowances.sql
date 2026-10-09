-- Investor directory plan allowances, top ups and the Manual outreach email cap.
-- (founder_premium itself was added by 20261009160000_founder_premium_plan.sql.)
--
-- 1. upgrade_requests accepts founder_premium and directory top up keys.
-- 2. Each founder plan includes directory contact space and a Manual outreach
--    email allowance per 30 day period (investor_directory_plan_allowances).
-- 3. The Directory 1k to 20k tiers become top ups added on top of the plan, and
--    each carries extra emails (email_limit).
-- 4. manual_outreach_sends logs every Manual outreach email that really went
--    out, so the email cap can be counted per founder.
--
-- New tables are service role only: RLS on, no policies, so no browser client
-- can read or write them (same as the other investor_directory tables).

-- ── 1. Upgrade requests ─────────────────────────────────────────────────────
-- Also allows investor directory top up keys (directory_1k ...): the directory
-- "Request" button stores the top up key here, which the old check rejected.
alter table public.upgrade_requests drop constraint if exists upgrade_requests_requested_plan_check;
alter table public.upgrade_requests add constraint upgrade_requests_requested_plan_check check (
  requested_plan is null
  or requested_plan = any (array[
    'founder_trial', 'founder_basic', 'founder_professional', 'founder_premium', 'investor_free'
  ])
  or requested_plan like 'directory\_%'
);

-- ── 2. Plan allowances ──────────────────────────────────────────────────────
create table if not exists public.investor_directory_plan_allowances (
  plan_type text primary key,
  label text not null,
  contacts int not null default 0 check (contacts >= 0),
  emails_per_month int not null default 0 check (emails_per_month >= 0),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.investor_directory_plan_allowances (plan_type, label, contacts, emails_per_month, sort) values
  ('founder_free',         'Free',         0,     0,     0),
  ('founder_basic',        'Basic',        500,   1000,  1),
  ('founder_professional', 'Professional', 10000, 20000, 2),
  ('founder_premium',      'Premium',      20000, 40000, 3)
on conflict (plan_type) do nothing;

alter table public.investor_directory_plan_allowances enable row level security;

-- ── 3. Tiers become top ups ─────────────────────────────────────────────────
alter table public.investor_directory_tiers add column if not exists email_limit int not null default 0;

-- Backfill: each top up adds two emails a month per contact, and is renamed "+".
update public.investor_directory_tiers
set email_limit = hold_limit * 2,
    label = replace(label, 'Directory ', 'Directory +')
where key <> 'free' and label not like 'Directory +%';

-- ── 4. Manual outreach send log ─────────────────────────────────────────────
create table if not exists public.manual_outreach_sends (
  id bigint generated always as identity primary key,
  founder_id uuid references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_id uuid references public.founder_manual_outreach_recipients(id) on delete set null,
  email text,
  step_index int,
  sent_at timestamptz not null default now()
);

create index if not exists manual_outreach_sends_founder_sent_idx on public.manual_outreach_sends (founder_id, sent_at);
create index if not exists manual_outreach_sends_company_sent_idx on public.manual_outreach_sends (company_id, sent_at);

alter table public.manual_outreach_sends enable row level security;
