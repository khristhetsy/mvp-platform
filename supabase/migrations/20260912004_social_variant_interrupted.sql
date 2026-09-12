-- Allow the 'interrupted' variant status.
--
-- The queue claims a variant by flipping queued → publishing before calling the platform.
-- If the function is killed mid-call (a hung platform against the 60s limit, or the
-- database going away), no catch block runs and the row is stranded in 'publishing'
-- forever: later passes select only 'queued', so nothing ever looks at it again and the
-- post silently never goes out.
--
-- 'interrupted' is that state made visible and actionable. It is deliberately NOT
-- 'failed': failed means we know it didn't publish, whereas an interrupted variant may
-- already be live on the platform — the claim happens before the API call. Staff check,
-- then Requeue or Mark as published.
--
-- Without widening this constraint the sweep would fail on every row (23514), which is
-- the same shape of bug as the inv_source enum rejecting 'inferred'.

alter table public.social_variants
  drop constraint if exists social_variants_status_check;
alter table public.social_variants
  add constraint social_variants_status_check
  check (status in ('draft', 'parked', 'queued', 'publishing', 'interrupted', 'published', 'failed', 'skipped', 'archived'));

-- The sweep looks for stale claims: status + updated_at.
create index if not exists social_variants_publishing_stale_idx
  on public.social_variants (status, updated_at)
  where status in ('publishing', 'interrupted');
