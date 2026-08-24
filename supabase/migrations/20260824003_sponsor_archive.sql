-- Soft-archive for sponsors. Archived booths are hidden from the catalog's default
-- view and from the event "attach" picker, but keep their logo, video, leads, and
-- existing event links, and can be restored. NULL = active.
alter table public.sponsors add column if not exists archived_at timestamptz;

create index if not exists sponsors_active_idx on public.sponsors (archived_at) where archived_at is null;
