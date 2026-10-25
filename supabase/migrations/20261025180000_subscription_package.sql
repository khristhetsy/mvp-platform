-- Subscription package (Sales Hub › Contracts › Send SPV contracts › Subscription package).
-- Additive only. Nothing existing changes behavior:
--   * a new template kind, 'subscription', for the package's Word masters;
--   * each master says which package and part it belongs to, and whether the
--     subscriber signs it ('sign') or only reads it ('review');
--   * a new field type, 'derived', for values nobody types (the number of
--     Interests is the subscription amount divided by $50,000).
-- No new tables, so no new RLS. contract_templates and contract_template_fields
-- keep their staff only select policies. The masters themselves are installed from
-- the app (Contracts > Install masters), like the term sheets.

alter table public.contract_templates drop constraint if exists contract_templates_kind_check;
alter table public.contract_templates
  add constraint contract_templates_kind_check
  check (kind in ('term_sheet', 'services_agreement', 'advisory_agreement', 'nda', 'subscription'));

alter table public.contract_templates
  add column if not exists package_key text,
  add column if not exists part_key text,
  add column if not exists delivery text not null default 'sign';

alter table public.contract_templates drop constraint if exists contract_templates_delivery_check;
alter table public.contract_templates
  add constraint contract_templates_delivery_check check (delivery in ('sign', 'review'));

alter table public.contract_templates drop constraint if exists contract_templates_part_key_check;
alter table public.contract_templates
  add constraint contract_templates_part_key_check
  check (part_key is null or part_key in ('cover_index', 'signature_pages', 'forms', 'ppm', 'agreement', 'instructions'));

alter table public.contract_template_fields drop constraint if exists contract_template_fields_type_check;
alter table public.contract_template_fields
  add constraint contract_template_fields_type_check
  check (type in ('text', 'date', 'currency', 'percent', 'multiline', 'derived'));
