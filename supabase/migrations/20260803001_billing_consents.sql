-- Records each founder's acknowledgment of the non-refundable billing terms at
-- checkout (services rendered immediately). Audit trail for chargeback/dispute
-- defense. Inserts happen via the service role in /api/billing/checkout; anon
-- and normal users cannot read it; staff can.

create table if not exists public.billing_consents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  profile_id uuid not null,
  email text,
  plan_type text,
  policy_version text,
  accepted_at timestamptz not null,
  user_agent text
);

alter table public.billing_consents enable row level security;

drop policy if exists "staff_read_billing_consents" on public.billing_consents;
create policy "staff_read_billing_consents" on public.billing_consents
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst'))
  );

create index if not exists billing_consents_profile_idx on public.billing_consents (profile_id, created_at);
