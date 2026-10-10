-- Accounting app (approved Oct 9, 2026): invoicing, A/R and a Bank of America
-- feed through Plaid (read only). Staff only. No money moves through iCapOS:
-- customers pay by bank transfer and staff confirm the deposit.
--
-- Run in the Supabase SQL editor. Safe to re-run.

-- ─── 1. Customers ────────────────────────────────────────────────────────────
create table if not exists public.acct_customers (
  id uuid primary key default gen_random_uuid(),
  entity text not null default 'icfo_capital_global' check (entity in ('icfo_capital_global', 'icfo_venture_group')),
  contact_name text,
  company text,
  email text,
  phone text,
  address text,
  crm_contact_id uuid references public.crm_contacts(id) on delete set null,
  notes text,
  archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint acct_customers_named check (coalesce(nullif(trim(company), ''), nullif(trim(contact_name), '')) is not null)
);
create index if not exists acct_customers_entity_idx on public.acct_customers (entity, archived);

-- ─── 2. Invoices and lines ───────────────────────────────────────────────────
-- status: draft (not sent), scheduled (sends itself on issue_date), sent, paid, void.
-- "Overdue" and "Partly paid" are worked out from due_date and amount_paid_cents.
create table if not exists public.acct_invoices (
  id uuid primary key default gen_random_uuid(),
  entity text not null default 'icfo_capital_global' check (entity in ('icfo_capital_global', 'icfo_venture_group')),
  invoice_number text not null unique,
  customer_id uuid not null references public.acct_customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'paid', 'void')),
  issue_date date not null,
  due_date date not null,
  currency text not null default 'USD',
  total_cents integer not null check (total_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  memo text,
  -- A monthly series ("$2,000 a month for 4 months") shares one series_id.
  series_id uuid,
  series_index integer,
  series_count integer,
  public_token text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  sent_at timestamptz,
  last_emailed_to text,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists acct_invoices_status_idx on public.acct_invoices (status, due_date);
create index if not exists acct_invoices_customer_idx on public.acct_invoices (customer_id, issue_date desc);
create index if not exists acct_invoices_series_idx on public.acct_invoices (series_id, series_index);

create table if not exists public.acct_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.acct_invoices(id) on delete cascade,
  position integer not null default 0,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_cents integer not null check (unit_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0)
);
create index if not exists acct_invoice_lines_invoice_idx on public.acct_invoice_lines (invoice_id, position);

-- ─── 3. Bank feed (Plaid, read only) and file imports ────────────────────────
-- Plaid access tokens are encrypted in the app (TOKEN_ENCRYPTION_SECRET) and the
-- table has RLS on with NO policies: only the server (service role) reads it.
create table if not exists public.acct_bank_items (
  id uuid primary key default gen_random_uuid(),
  entity text not null default 'icfo_capital_global' check (entity in ('icfo_capital_global', 'icfo_venture_group')),
  plaid_item_id text not null unique,
  access_token_enc text not null,
  institution_name text,
  sync_cursor text,
  status text not null default 'active' check (status in ('active', 'needs_login', 'error', 'removed')),
  last_error text,
  last_synced_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.acct_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  entity text not null default 'icfo_capital_global' check (entity in ('icfo_capital_global', 'icfo_venture_group')),
  item_id uuid references public.acct_bank_items(id) on delete cascade,
  -- Null for an account fed only by CSV / QFX imports.
  plaid_account_id text unique,
  name text not null,
  mask text,
  type text,
  subtype text,
  current_balance_cents bigint,
  available_balance_cents bigint,
  balance_at timestamptz,
  created_at timestamptz not null default now()
);

-- amount_cents: positive = money in, negative = money out (Plaid's sign flipped).
-- status: review (needs a decision), matched (paid an invoice), categorized, ignored.
create table if not exists public.acct_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.acct_bank_accounts(id) on delete cascade,
  source text not null check (source in ('plaid', 'import')),
  external_id text not null,
  posted_on date not null,
  description text not null,
  merchant text,
  amount_cents bigint not null,
  pending boolean not null default false,
  status text not null default 'review' check (status in ('review', 'matched', 'categorized', 'ignored')),
  category text,
  matched_invoice_id uuid references public.acct_invoices(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, external_id)
);
create index if not exists acct_bank_tx_status_idx on public.acct_bank_transactions (status, posted_on desc);

-- ─── 4. Payments ─────────────────────────────────────────────────────────────
create table if not exists public.acct_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.acct_invoices(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null,
  method text not null default 'ach' check (method in ('ach', 'wire', 'check', 'card', 'other')),
  reference text,
  bank_transaction_id uuid references public.acct_bank_transactions(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists acct_payments_invoice_idx on public.acct_payments (invoice_id);

-- ─── 5. Invoice numbers ──────────────────────────────────────────────────────
-- iCFO Capital Global shares the Premium wire invoice sequence, so one company
-- never issues two invoices with the same number: INV-2026-0007.
-- iCFO Venture Group has its own series: IVG-2026-0001.
create sequence if not exists public.wire_invoice_seq start 1;
create sequence if not exists public.acct_ivg_invoice_seq start 1;

create or replace function public.next_acct_invoice_number(p_entity text)
returns text
language sql
security definer
set search_path = public
as $$
  select case when p_entity = 'icfo_venture_group'
    then 'IVG-' || to_char(now() at time zone 'America/Los_Angeles', 'YYYY') || '-' || lpad(nextval('public.acct_ivg_invoice_seq')::text, 4, '0')
    else 'INV-' || to_char(now() at time zone 'America/Los_Angeles', 'YYYY') || '-' || lpad(nextval('public.wire_invoice_seq')::text, 4, '0')
  end;
$$;
revoke all on function public.next_acct_invoice_number(text) from public, anon, authenticated;

-- ─── 6. RLS: staff only ──────────────────────────────────────────────────────
alter table public.acct_customers enable row level security;
alter table public.acct_invoices enable row level security;
alter table public.acct_invoice_lines enable row level security;
alter table public.acct_bank_items enable row level security;
alter table public.acct_bank_accounts enable row level security;
alter table public.acct_bank_transactions enable row level security;
alter table public.acct_payments enable row level security;

drop policy if exists "staff_all_acct_customers" on public.acct_customers;
create policy "staff_all_acct_customers" on public.acct_customers for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_all_acct_invoices" on public.acct_invoices;
create policy "staff_all_acct_invoices" on public.acct_invoices for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_all_acct_invoice_lines" on public.acct_invoice_lines;
create policy "staff_all_acct_invoice_lines" on public.acct_invoice_lines for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_read_acct_bank_accounts" on public.acct_bank_accounts;
create policy "staff_read_acct_bank_accounts" on public.acct_bank_accounts for select using (public.is_staff());
drop policy if exists "staff_all_acct_bank_transactions" on public.acct_bank_transactions;
create policy "staff_all_acct_bank_transactions" on public.acct_bank_transactions for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_all_acct_payments" on public.acct_payments;
create policy "staff_all_acct_payments" on public.acct_payments for all using (public.is_staff()) with check (public.is_staff());
-- acct_bank_items: no policies on purpose (encrypted Plaid tokens, service role only).
