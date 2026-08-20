-- Sales pipeline stage → marketing sequence mapping.
-- When an opportunity enters a stage that has a sequence, its contact is
-- auto-enrolled into that marketing sequence (reusing the existing sequence
-- engine: steps, delays, templates, suppressions).

alter table public.sales_stages
  add column if not exists sequence_id uuid
  references public.marketing_sequences(id) on delete set null;

comment on column public.sales_stages.sequence_id is
  'Optional marketing sequence to auto-enroll an opportunity''s contact into when the deal enters this stage.';
