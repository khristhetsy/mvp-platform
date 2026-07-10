-- Sales Forecast batch B: AI insights (immutable), sales journal (append-only),
-- and task source linkage. RLS enabled, service-role access via admin routes.

-- ── AI Sales insights (immutable; regeneration inserts a new row) ─────────────
create table if not exists public.sales_ai_insights (
  id               uuid primary key default gen_random_uuid(),
  metric_key       text not null check (metric_key in ('mrr','arr','proj','variance')),
  snapshot_id      uuid references public.sales_forecast_snapshots(id) on delete cascade,
  generated_at     timestamptz not null default now(),
  model            text,
  input_hash       text not null,
  narrative        text not null,
  drivers          jsonb not null default '[]',
  suggested_actions jsonb not null default '[]',
  created_by       uuid references public.profiles(id)
);
create index if not exists sales_ai_insights_lookup_idx
  on public.sales_ai_insights (metric_key, snapshot_id, generated_at desc);
alter table public.sales_ai_insights enable row level security;

drop trigger if exists sales_ai_insights_immutable on public.sales_ai_insights;
create trigger sales_ai_insights_immutable
  before update or delete on public.sales_ai_insights
  for each row execute function public.sales_forecast_block_mutation();

-- ── Sales journal (append-only; only `pinned` mutable; no deletes) ────────────
create table if not exists public.sales_journal_entries (
  id           uuid primary key default gen_random_uuid(),
  entry_type   text not null check (entry_type in ('note','win','loss','deal','system')),
  body         text not null,
  tags         text[] not null default '{}',
  pinned       boolean not null default false,
  author_id    uuid references public.profiles(id),   -- null = system
  deal_ref     uuid,
  snapshot_ref uuid references public.sales_forecast_snapshots(id) on delete set null,
  revision_of  uuid references public.sales_journal_entries(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists sales_journal_created_idx on public.sales_journal_entries (created_at desc);
create index if not exists sales_journal_type_idx on public.sales_journal_entries (entry_type);
alter table public.sales_journal_entries enable row level security;

create or replace function public.sales_journal_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'sales_journal_entries cannot be deleted (append-only)';
  end if;
  if (new.entry_type, new.body, new.tags, new.author_id, new.deal_ref, new.snapshot_ref, new.revision_of, new.created_at)
     is distinct from
     (old.entry_type, old.body, old.tags, old.author_id, old.deal_ref, old.snapshot_ref, old.revision_of, old.created_at) then
    raise exception 'sales_journal_entries are append-only (only pinned is mutable)';
  end if;
  return new;
end;
$$;
drop trigger if exists sales_journal_guard on public.sales_journal_entries;
create trigger sales_journal_guard
  before update or delete on public.sales_journal_entries
  for each row execute function public.sales_journal_guard();

-- ── Task source linkage (reuse existing sales_tasks) ─────────────────────────
alter table public.sales_tasks add column if not exists source_kind text not null default 'manual';
alter table public.sales_tasks add column if not exists source_ref uuid;
