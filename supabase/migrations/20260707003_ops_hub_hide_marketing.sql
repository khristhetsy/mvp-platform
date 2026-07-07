-- Hide the Marketing Hub surface from the Operations Hub (reversible; content preserved).
-- Additive so it won't disturb any surfaces already hidden via the UI.
update public.ops_hub_settings
  set drift_ignored = array_append(drift_ignored, '/admin/marketing')
  where id = 1 and not ('/admin/marketing' = any(coalesce(drift_ignored, '{}')));
