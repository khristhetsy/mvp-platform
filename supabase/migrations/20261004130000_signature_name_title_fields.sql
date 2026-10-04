-- E-signature: two new founder fields.
--  * name  : fills in the signer's name (read only to the signer), like company.
--  * title : the signer picks one or more titles from a list the sender sets
--            (default CEO, President, Founder, Owner); stored as "CEO, Founder".
-- Additive. Existing fields and envelopes are untouched.

alter table public.signature_fields drop constraint if exists signature_fields_field_type_check;
alter table public.signature_fields add constraint signature_fields_field_type_check
  check (field_type in ('signature', 'date', 'company', 'text', 'initial', 'name', 'title'));

alter table public.signature_fields drop constraint if exists signature_fields_auto_source_check;
alter table public.signature_fields add constraint signature_fields_auto_source_check
  check (auto_source in ('signing_date', 'signer_company', 'signer_name'));

-- Title choices: { "choices": ["CEO", "President", "Founder", "Owner"], "multiple": true }
alter table public.signature_fields add column if not exists options jsonb;
