-- Event timezone (IANA name, e.g. "America/Los_Angeles") so schedule times can be
-- shown and edited with their zone. Nullable — existing events keep their raw
-- timestamps and simply don't display a zone until one is set.
alter table public.events add column if not exists timezone text;
