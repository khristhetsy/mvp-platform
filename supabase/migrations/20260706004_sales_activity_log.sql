-- Sales activity log — one row per tracked event (notes, tasks, stage changes,
-- won/lost, conversions, contact edits). Powers the contact profile timeline.
-- Service-role only (RLS on, no policy). Also renames the default "Demo" stage to "Meeting".

create table if not exists public.sales_activity_log (
  id uuid primary key default gen_random_uuid(),
  contact_crm_id text,
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,                 -- note | contact_edit | task_created | task_done | converted | stage_changed | won | lost | opp_note | email_draft
  summary text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_activity_contact on public.sales_activity_log (contact_crm_id, created_at desc);
create index if not exists idx_sales_activity_opp on public.sales_activity_log (opportunity_id, created_at desc);
alter table public.sales_activity_log enable row level security;

-- Rename the seeded "Demo" stage to "Meeting" (idempotent).
update public.sales_stages set name = 'Meeting' where name = 'Demo';
