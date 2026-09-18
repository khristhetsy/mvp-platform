-- IR Hub: scheduled founder summaries (spec 5.9).
-- Two per-project toggles and a send log so each period goes out once. The summaries are
-- the founder-safe interactive digest (figures, pipeline, communications log, IR notes) —
-- no AI text, so nothing needs staff approval before it goes. Run in the SQL editor.

alter table public.ir_projects
  add column if not exists weekly_summary  boolean not null default false,
  add column if not exists monthly_summary boolean not null default false;

create table if not exists public.ir_summary_sends (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.ir_projects(id) on delete cascade,
  kind          text not null check (kind in ('week','month')),
  period_start  date not null,
  period_end    date not null,
  sent_to       text not null,
  sent_at       timestamptz not null default now(),
  unique (project_id, kind, period_start)
);
create index if not exists ir_summary_sends_project_idx on public.ir_summary_sends (project_id, sent_at desc);

alter table public.ir_summary_sends enable row level security;
drop policy if exists ir_summary_sends_staff_all on public.ir_summary_sends;
create policy ir_summary_sends_staff_all on public.ir_summary_sends
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
