-- The Feature Controls → Departments matrix reads from the public.features catalog.
-- Scheduling (/admin/schedule) and Meet (/admin/meet) are in the Calendar nav group
-- but were never seeded, so they didn't appear as toggle rows. Add them.

insert into public.features (key, label, hub_key, path, sort_order) values
  ('scheduling', 'Scheduling', 'general_admin', '/admin/schedule', 221),
  ('meet',       'Meet',       'general_admin', '/admin/meet',     222)
on conflict (key) do nothing;
