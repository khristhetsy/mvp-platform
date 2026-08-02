-- Seed the iCapOS marketing-site event schedule (spec §6, §14 step 3). The /events
-- page reads these rows. The PE Expo is registration-open; the recurring
-- placeholders have no confirmed date and are not yet open.

insert into public.marketing_events (title, kind, city, starts_at, ends_at, registration_open, sort_order)
values
  ('iCFO PE Expo — Newport Beach', 'expo', 'Newport Beach, California',
   '2026-08-25 19:00:00+00', '2026-08-25 23:00:00+00', true, 1),
  ('iCFO Investment Conference — September', 'conference', null,
   null, null, false, 2),
  ('iCFO PE Expo — city to be announced', 'expo', null,
   null, null, false, 3)
on conflict do nothing;
