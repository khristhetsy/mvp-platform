-- Pledged amounts: ships OFF for every audience. An admin turns it on per audience
-- from Feature Controls (feature key "pledged"). Hiding only: no pledge data is
-- changed or removed, and turning the switch back on restores everything.
-- Feature keys and audiences are validated in app code (constraints were dropped
-- in 20260623003), so no schema change is needed.

insert into public.feature_flags (audience, feature, enabled)
values
  ('founder',  'pledged', false),
  ('investor', 'pledged', false),
  ('admin',    'pledged', false)
on conflict (audience, feature) do nothing;
