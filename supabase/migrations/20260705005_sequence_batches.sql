-- Gated sequences — when a step's delay hits, the runner collects the due
-- contacts into a PENDING BATCH that a human must review & release (same
-- "no send without a click" firewall as one-shot campaigns), instead of
-- auto-sending. Release is permission-gated (manage_actions / super_admin).

-- 1) Pending batches
create table if not exists public.marketing_sequence_batches (
  id             uuid primary key default gen_random_uuid(),
  sequence_id    uuid not null references public.marketing_sequences(id) on delete cascade,
  step_id        uuid references public.marketing_sequence_steps(id) on delete set null,
  step_order     int  not null default 1,
  status         text not null default 'pending'
                   check (status in ('pending', 'released', 'held', 'cancelled')),
  eligible_count  int not null default 0,
  will_send_count int not null default 0,
  suppressed_count int not null default 0,
  skipped_count    int not null default 0,
  created_at     timestamptz not null default now(),
  released_by    uuid references public.profiles(id),
  released_at    timestamptz
);

create index if not exists marketing_seq_batches_pending_idx
  on public.marketing_sequence_batches (status) where status = 'pending';

alter table public.marketing_sequence_batches enable row level security;
-- service-role only (server reads/writes); no anon/authenticated policy on purpose.

-- 2) Enrollment can be parked awaiting approval, linked to its batch
alter table public.marketing_sequence_enrollments
  add column if not exists batch_id uuid references public.marketing_sequence_batches(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketing_sequence_enrollments_status_check'
  ) then
    -- table may use an inline (unnamed) check; add awaiting_approval defensively
    null;
  end if;
end $$;

-- Recreate the status check to include 'awaiting_approval'
alter table public.marketing_sequence_enrollments
  drop constraint if exists marketing_sequence_enrollments_status_check;
alter table public.marketing_sequence_enrollments
  add constraint marketing_sequence_enrollments_status_check
  check (status in ('active', 'completed', 'unsubscribed', 'bounced', 'awaiting_approval'));

create index if not exists marketing_enrollments_batch_idx
  on public.marketing_sequence_enrollments (batch_id) where batch_id is not null;
