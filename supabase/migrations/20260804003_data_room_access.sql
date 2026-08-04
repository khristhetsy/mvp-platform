-- Investor data-room access grants.
--
-- A founder (or staff) can grant a specific investor explicit, optionally
-- time-limited access to the company's data room, and revoke it. This is
-- additive to the existing implicit relationship-based access: an active grant
-- lets an investor in even without a saved deal / intro / interest row.
--
-- Active = revoked_at is null AND (expires_at is null OR expires_at > now()).
-- One grant per (company, investor) — re-granting updates it in place.
-- Additive and idempotent — safe to apply on staging first, then production.

create table if not exists public.data_room_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'full',
  granted_by uuid references public.profiles(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, investor_id)
);

create index if not exists data_room_access_company_idx on public.data_room_access (company_id);
create index if not exists data_room_access_investor_idx on public.data_room_access (investor_id);

comment on table public.data_room_access is
  'Explicit, revocable, optionally-expiring investor access to a company data room. Additive to relationship-based access.';
