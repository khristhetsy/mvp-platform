-- ============================================================
-- 0077_portfolio_investments.sql — Investor Deal Tracker
-- Stores investor portfolio investments — two modes:
--   1. Platform-linked: deal_room_id set → source='deal_room'
--   2. Self-reported:   deal_room_id null → source='self_reported'
-- ============================================================

create table if not exists public.portfolio_investments (
  id                  uuid        primary key default gen_random_uuid(),
  investor_user_id    uuid        not null references auth.users(id) on delete cascade,
  company_id          uuid        references public.companies(id) on delete set null,
  deal_room_id        uuid        references public.deal_rooms(id) on delete set null,
  company_name        text        not null,
  sector              text,
  amount_invested     numeric     not null check (amount_invested > 0),
  entry_valuation     numeric,
  current_valuation   numeric,
  stage               text        check (stage in (
                        'pre_seed','seed','series_a','series_b',
                        'growth','ipo','exited','written_off'
                      )),
  source              text        not null default 'self_reported'
                                  check (source in ('deal_room','self_reported')),
  invested_at         date        not null,
  notes               text,
  val_updated_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- auto-update updated_at
create or replace function public.set_portfolio_investments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolio_investments_updated_at on public.portfolio_investments;
create trigger portfolio_investments_updated_at
  before update on public.portfolio_investments
  for each row execute procedure public.set_portfolio_investments_updated_at();

-- indexes
create index if not exists pi_investor_user_idx  on public.portfolio_investments (investor_user_id);
create index if not exists pi_company_id_idx     on public.portfolio_investments (company_id);
create index if not exists pi_deal_room_id_idx   on public.portfolio_investments (deal_room_id);
create index if not exists pi_invested_at_idx    on public.portfolio_investments (invested_at);

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.portfolio_investments enable row level security;

-- Investors see only their own; admins see all
drop policy if exists "pi_select" on public.portfolio_investments;
create policy "pi_select"
  on public.portfolio_investments for select
  using (
    investor_user_id = auth.uid()
    or is_admin()
  );

drop policy if exists "pi_insert" on public.portfolio_investments;
create policy "pi_insert"
  on public.portfolio_investments for insert
  with check (
    investor_user_id = auth.uid()
    or is_admin()
  );

drop policy if exists "pi_update" on public.portfolio_investments;
create policy "pi_update"
  on public.portfolio_investments for update
  using (
    investor_user_id = auth.uid()
    or is_admin()
  );

drop policy if exists "pi_delete" on public.portfolio_investments;
create policy "pi_delete"
  on public.portfolio_investments for delete
  using (
    investor_user_id = auth.uid()
    or is_admin()
  );
