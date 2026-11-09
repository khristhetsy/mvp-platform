-- Investor support: investors open tickets in the same support queue as founders.
-- The existing founder_id column holds the requester's profile id (founder or investor),
-- so every existing row-level security policy keeps working for investors unchanged.
-- Investors have no company, so company_id becomes optional for them.
-- Additive and idempotent. Apply on staging, verify, then production.

alter table public.support_requests alter column company_id drop not null;

alter table public.support_requests
  add column if not exists requester_role text not null default 'founder';

alter table public.support_requests drop constraint if exists support_requests_requester_role_check;
alter table public.support_requests
  add constraint support_requests_requester_role_check check (requester_role in ('founder', 'investor'));

-- A founder ticket always belongs to a company. An investor ticket has none.
alter table public.support_requests drop constraint if exists support_requests_requester_company_check;
alter table public.support_requests
  add constraint support_requests_requester_company_check check (requester_role <> 'founder' or company_id is not null);

create index if not exists support_requests_requester_role_idx on public.support_requests (requester_role, created_at desc);
