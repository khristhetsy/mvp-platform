-- Duplicate pending sequence batches: overlapping collector runs could create two
-- pending batches for the same sequence + step. Clean up existing duplicates and add a
-- partial unique index so at most one pending batch exists per (sequence_id, step_order).

-- 1) Drop orphaned pending batches (no recipients still awaiting approval).
delete from public.marketing_sequence_batches b
where b.status = 'pending'
  and not exists (
    select 1 from public.marketing_sequence_enrollments e
    where e.batch_id = b.id and e.status = 'awaiting_approval'
  );

-- 2) For any remaining duplicates, keep the earliest pending batch per sequence+step;
--    return the others' recipients to 'active' (so they get re-collected) and drop them.
with dups as (
  select id from (
    select id, row_number() over (partition by sequence_id, step_order order by created_at) as rn
    from public.marketing_sequence_batches where status = 'pending'
  ) x where rn > 1
)
update public.marketing_sequence_enrollments
set status = 'active', batch_id = null
where status = 'awaiting_approval' and batch_id in (select id from dups);

delete from public.marketing_sequence_batches
where id in (
  select id from (
    select id, row_number() over (partition by sequence_id, step_order order by created_at) as rn
    from public.marketing_sequence_batches where status = 'pending'
  ) x where rn > 1
);

-- 3) Enforce one pending batch per sequence+step going forward.
create unique index if not exists marketing_sequence_batches_one_pending
on public.marketing_sequence_batches (sequence_id, step_order)
where status = 'pending';
