-- Founder-added investors: an investor the founder sourced themselves (LinkedIn,
-- AngelList, a warm intro, a conversation) that they want to track and open a
-- private deal room for — no investor account or invite required. Feeds the
-- founder's pipeline tagged "added by you"; never counted as verified interest.
-- Additive + idempotent. Apply on staging, verify, then production.

create table if not exists public.founder_manual_investors (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  founder_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  firm        text,
  email       text,
  source      text,                 -- linkedin | angellist | intro | event | inbound | other
  check_size  text,
  notes       text,
  status      text not null default 'tracking'
    check (status in ('tracking', 'in_diligence', 'closed', 'passed')),
  invited     boolean not null default false,
  invited_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists founder_manual_investors_company_idx
  on public.founder_manual_investors (company_id, created_at desc);
create index if not exists founder_manual_investors_founder_idx
  on public.founder_manual_investors (founder_id, created_at desc);

alter table public.founder_manual_investors enable row level security;

-- The founder owns their own rows (read/insert/update/delete).
drop policy if exists fmi_founder_all on public.founder_manual_investors;
create policy fmi_founder_all on public.founder_manual_investors
  for all using (founder_id = auth.uid()) with check (founder_id = auth.uid());

-- Staff can read for support/analytics.
drop policy if exists fmi_staff_read on public.founder_manual_investors;
create policy fmi_staff_read on public.founder_manual_investors
  for select using (public.is_staff());
