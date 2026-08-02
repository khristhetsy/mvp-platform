-- Seed template for the home-page client logo strip (marketing_site_logos).
--
-- Fill in REAL client / portfolio companies of iCFO Capital Global only, with
-- permission to display each mark. Do NOT invent relationships — the strip is a
-- compliance-sensitive claim ("companies iCFO Capital Global has worked with").
--
-- logo_url can be:
--   • a public URL, or
--   • a Supabase Storage public path (upload the SVG/PNG to a public bucket first).
-- Prefer transparent SVG or PNG; the strip renders them grayscale at ~28px tall.
--
-- Until this table has rows, the home strip shows only the heading + caption
-- (no logos) — which is the correct, safe empty state.

insert into public.marketing_site_logos (name, logo_url, sort_order, active) values
  ('REPLACE — Company One', 'https://REPLACE.example.com/logos/company-one.svg', 1, true),
  ('REPLACE — Company Two', 'https://REPLACE.example.com/logos/company-two.svg', 2, true),
  ('REPLACE — Company Three', 'https://REPLACE.example.com/logos/company-three.svg', 3, true)
on conflict do nothing;

-- To hide one without deleting it:  update public.marketing_site_logos set active = false where name = '…';
