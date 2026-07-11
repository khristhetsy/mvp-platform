-- Marketing Hub fix: editable ORG billing profile (the company's own billing identity:
-- company, billing contact, address). Single-row table keyed by a fixed id. Card entry
-- for payment methods stays on the Lemon Squeezy hosted form — never stored here.

create table if not exists public.org_billing_profile (
  id              text primary key default 'default',
  company         text,
  billing_contact text,
  address         text,
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz not null default now()
);

insert into public.org_billing_profile (id) values ('default') on conflict (id) do nothing;

alter table public.org_billing_profile enable row level security;

drop policy if exists org_billing_profile_staff on public.org_billing_profile;
create policy org_billing_profile_staff on public.org_billing_profile
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update on public.org_billing_profile to service_role;
