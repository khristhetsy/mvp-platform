-- Dual-lane model — Step 1 (onboarding slice): capital-structure / offering type.
--
-- Mapped onto the existing `companies` model (this repo has no `founder_profiles`
-- table; founders are `profiles` + `companies`). The spec's founder_profiles.*
-- offering columns live on `companies` here.
--
-- The marketplace_listings / matches / view-log tables + reg_cf trigger + RLS
-- from the main spec land with their respective lanes (Lane A / Lane B), also
-- mapped onto companies.

do $$ begin
  create type offering_type as enum ('reg_cf', 'reg_d_506b', 'reg_d_506c', 'not_raising');
exception when duplicate_object then null; end $$;

alter table public.companies
  add column if not exists offering_type offering_type not null default 'not_raising',
  add column if not exists offering_type_attested_at timestamptz,
  add column if not exists offering_type_attested_by uuid references auth.users(id);

comment on column public.companies.offering_type is
  'Founder-attested securities exemption. Set during onboarding; editable only via a re-attesting settings flow. iCapOS does not verify the exemption.';
