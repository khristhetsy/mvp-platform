-- Contacts grouped by Industry put founders under "Unassigned" even though their
-- profile page shows an Industry.
--
-- Why: the profile page reads Industry from overrides->'Industries' (staff edits and
-- the 2026-09-30 founder-fill import write there) on top of Odoo's synced value. The
-- grid, filters and group counts read profile->'industries', and the trigger that
-- builds `profile` only folded overrides in for investorTypes (20260916001). Same bug,
-- different facet.
--
-- Fix: the trigger now applies an Industries override the same way the profile page
-- does (src/lib/sales/contacts.ts): a non-empty override replaces the synced list, an
-- empty override clears it, no override keeps Odoo's value. Nothing else in `profile`
-- changes, and the search / bucket functions keep reading `profile` unchanged.

create or replace function public.contact_industries_override(p_overrides jsonb)
returns jsonb language sql immutable parallel safe as $$
  -- null = no override (keep the synced value); otherwise the trimmed, deduped list.
  select case
    when p_overrides is null or jsonb_typeof(p_overrides) <> 'object'
      or jsonb_typeof(p_overrides -> 'Industries') is distinct from 'array' then null
    else coalesce(
      (select jsonb_agg(v order by first_pos)
         from (select btrim(e) as v, min(ord) as first_pos
                 from jsonb_array_elements_text(p_overrides -> 'Industries') with ordinality as t(e, ord)
                where btrim(e) <> ''
                group by btrim(e)) s),
      '[]'::jsonb)
  end
$$;

create or replace function public.crm_contacts_sync_profile()
returns trigger language plpgsql as $$
declare
  ind jsonb := public.contact_industries_override(new.overrides);
begin
  new.profile := coalesce(new.raw -> '__profile', '{}'::jsonb)
              || jsonb_build_object('investorTypes', public.investor_profile_merge(new.overrides, new.raw))
              || case when ind is null then '{}'::jsonb else jsonb_build_object('industries', ind) end;
  new.profile_v := 2;
  return new;
end $$;

-- Trigger definition is unchanged (still fires on raw and overrides writes).

-- Backfill: rows that carry an Industries override. Run once per leading hex digit
-- of the id (0..f) so each statement walks a primary-key range, not the whole table.
--   update public.crm_contacts
--      set profile = coalesce(raw -> '__profile', '{}'::jsonb)
--                 || jsonb_build_object('investorTypes', public.investor_profile_merge(overrides, raw))
--                 || jsonb_build_object('industries', public.contact_industries_override(overrides))
--    where id >= '00000000-0000-0000-0000-000000000000' and id < '10000000-0000-0000-0000-000000000000'
--      and overrides ? 'Industries' and jsonb_typeof(overrides -> 'Industries') = 'array';
