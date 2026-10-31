-- Sales AI queue: the opportunities that need attention today.
--
-- One row per opportunity per day, filled the first time anyone opens the queue
-- that day (see src/lib/sales-ai/queue-store.ts), so the page never recomputes
-- on a view. The ranking is rules, not a model: each row keeps the reasons that
-- put it there. Skip and Snooze are the only writes a person makes.
--
-- RLS: staff only (admin, analyst). The routes use the service role.

create table if not exists public.sales_ai_queue_items (
  id             uuid primary key default gen_random_uuid(),
  day            date not null,
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  rank           integer not null,
  score          integer not null default 0,
  reasons        jsonb not null default '[]'::jsonb,
  stage_name     text,
  status         text not null default 'open' check (status in ('open', 'skipped', 'snoozed')),
  snoozed_until  date,
  decided_by     uuid references auth.users(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  constraint sales_ai_queue_items_day_opp_key unique (day, opportunity_id)
);

create index if not exists sales_ai_queue_items_day_idx
  on public.sales_ai_queue_items (day, status, rank);

-- Looked up when building a day's queue, to leave out opportunities still snoozed.
create index if not exists sales_ai_queue_items_snooze_idx
  on public.sales_ai_queue_items (opportunity_id, snoozed_until)
  where snoozed_until is not null;

alter table public.sales_ai_queue_items enable row level security;

drop policy if exists sales_ai_queue_items_staff on public.sales_ai_queue_items;
create policy sales_ai_queue_items_staff on public.sales_ai_queue_items
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));
