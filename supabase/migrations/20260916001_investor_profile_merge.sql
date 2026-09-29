-- "Investor profile" (was "Investor type"): one merged value everywhere.
--
-- The grid groups / filters on profile->'investorTypes', but a contact's investor
-- profile can live in three places: a manual pick (overrides->'Investor type'),
-- Odoo's synced array (raw->'__profile'->'investorTypes'), or Odoo's raw
-- "Investor Profile" answer (raw->'__profile'->'extra'). Only the first was ever
-- reflected in `profile`, so hand-edited contacts (and un-normalised Odoo answers)
-- sat under "Unassigned" while the detail page showed a value.
--
-- Fix: `profile.investorTypes` is now the merge (override → synced → raw answer),
-- canonicalised to Odoo's option list, recomputed by trigger on ANY raw or
-- overrides write. The SQL search / bucket functions keep reading `profile`, so
-- nothing else changes and the GIN index still applies.

-- Odoo "Investor Profile" options. Aliases fold into the canonical spelling; an
-- unknown value is kept as typed (the UI shows it as unlisted).
create or replace function public.investor_profile_canon(v text)
returns text language sql immutable parallel safe as $$
  select case lower(btrim(v))
    when 'angel' then 'Angel Investor' when 'angels' then 'Angel Investor' when 'angel investor' then 'Angel Investor' when 'angel investors' then 'Angel Investor'
    when 'vc' then 'Venture Capital' when 'venture' then 'Venture Capital' when 'venture capital' then 'Venture Capital' when 'venture capitalist' then 'Venture Capital'
    when 'fund manager' then 'Fund Manager' when 'fund managers' then 'Fund Manager'
    when 'represent investors' then 'Represent Investors' when 'represents investors' then 'Represent Investors' when 'representing investors' then 'Represent Investors'
    when 'private equity' then 'Private Equity' when 'pe' then 'Private Equity'
    when 'family office' then 'Family Office' when 'family offices' then 'Family Office'
    when 'banker/lender' then 'Banker/Lender' when 'banker / lender' then 'Banker/Lender' when 'banker' then 'Banker/Lender'
    when 'investment bank' then 'Investment Bank' when 'investment banker' then 'Investment Bank'
    when 'hedge fund' then 'Hedge Fund' when 'hedge funds' then 'Hedge Fund'
    when 'lender' then 'Lender'
    when 'service provider' then 'Service Provider' when 'service providers' then 'Service Provider'
    when 'other' then 'Other' when 'others' then 'Other'
    else btrim(v)
  end
$$;

-- Merge order: manual override → Odoo synced array → Odoo raw "Investor Profile" answer.
-- Comma-joined strings are split; blanks / Odoo's `false` dropped; result deduped + sorted.
create or replace function public.investor_profile_merge(p_overrides jsonb, p_raw jsonb)
returns jsonb language plpgsql immutable parallel safe as $$
declare
  src jsonb;
  k   text;
  v   jsonb;
  res text[];
begin
  src := p_overrides -> 'Investor type';
  if src is null or jsonb_typeof(src) <> 'array' or jsonb_array_length(src) = 0 then
    src := p_raw -> '__profile' -> 'investorTypes';
  end if;
  if src is null or jsonb_typeof(src) <> 'array' or jsonb_array_length(src) = 0 then
    src := null;
    for k, v in select * from jsonb_each(coalesce(p_raw -> '__profile' -> 'extra', '{}'::jsonb)) loop
      if k ~* 'investor\s*(profile|type|category|class)|type\s*of\s*investor' then
        if jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0 then
          src := v; exit;
        elsif jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> '' and lower(btrim(v #>> '{}')) <> 'false' then
          src := jsonb_build_array(v #>> '{}'); exit;
        end if;
      end if;
    end loop;
  end if;
  if src is null then return '[]'::jsonb; end if;

  select coalesce(array_agg(distinct c order by c), '{}'::text[]) into res
  from (
    select public.investor_profile_canon(part) as c
    from jsonb_array_elements_text(src) e, unnest(string_to_array(e, ',')) part
    where btrim(part) <> '' and lower(btrim(part)) <> 'false'
  ) s;
  return to_jsonb(res);
end $$;

-- Which version of the profile computation a row carries; the backfill below walks
-- rows with profile_v < 2 in batches, and the trigger stamps 2 on every write.
alter table public.crm_contacts add column if not exists profile_v smallint not null default 0;
create index if not exists crm_contacts_profile_v_idx on public.crm_contacts (profile_v) where profile_v < 2;

-- Trigger now fires on overrides too (a detail-page edit lands in overrides).
create or replace function public.crm_contacts_sync_profile()
returns trigger language plpgsql as $$
begin
  new.profile := coalesce(new.raw -> '__profile', '{}'::jsonb)
              || jsonb_build_object('investorTypes', public.investor_profile_merge(new.overrides, new.raw));
  new.profile_v := 2;
  return new;
end $$;

drop trigger if exists crm_contacts_sync_profile on public.crm_contacts;
create trigger crm_contacts_sync_profile
  before insert or update of raw, overrides on public.crm_contacts
  for each row execute function public.crm_contacts_sync_profile();

-- Backfill: run this statement repeatedly until it reports 0 rows updated
-- (2,000 rows per run keeps each run to a few seconds in the SQL editor).
--   update public.crm_contacts
--      set profile_v = 2,
--          profile   = coalesce(raw -> '__profile', '{}'::jsonb)
--                   || jsonb_build_object('investorTypes', public.investor_profile_merge(overrides, raw))
--    where id in (select id from public.crm_contacts where profile_v < 2 limit 2000);
