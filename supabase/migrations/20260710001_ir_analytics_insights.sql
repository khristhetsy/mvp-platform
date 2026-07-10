-- Investor Relations Analytics — cached AI analyst narratives (one per metric).
-- Read-model cache: regeneration inserts a new row; serve the latest per metric_key.
-- RLS enabled, service-role access via admin routes.
create table if not exists public.ir_analytics_insights (
  id                uuid primary key default gen_random_uuid(),
  metric_key        text not null,
  input_hash        text not null,
  generated_at      timestamptz not null default now(),
  model             text,
  narrative         text not null,
  drivers           jsonb not null default '[]',
  suggested_actions jsonb not null default '[]',
  created_by        uuid references public.profiles(id)
);
create index if not exists ir_analytics_insights_lookup_idx
  on public.ir_analytics_insights (metric_key, generated_at desc);
alter table public.ir_analytics_insights enable row level security;
