-- Form D Desk — Investor Mode · §9 promote_prospect_investor()
-- Separate code path from the founder-side promote_contact() by design — a single
-- parameterized promote is exactly what eventually sends a founder campaign to a
-- fund. SECURITY INVOKER: runs as the authenticated staff user under RLS, never
-- the service role. Dedupe cascade matches (never duplicates) firms already in the
-- 6,000+ network — that list is the asset. OFAC hit is a hard stop (§10, test 14).
-- Open question 2 resolved: promoted firms join the 6,000+ list (segment
-- 'distribution'). Additive + idempotent. Review before running.

create or replace function public.promote_prospect_investor(
  p_firm_id      uuid,
  p_lawful_basis text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_firm   public.formd_firms%rowtype;
  v_ofac   text;
  v_match  uuid;
  v_action text;
begin
  select * into v_firm from public.formd_firms where id = p_firm_id;
  if not found then
    raise exception 'Firm % not found', p_firm_id;
  end if;

  -- OFAC hard stop: latest ofac_sdn result for this firm must not be a hit.
  select result into v_ofac
    from public.formd_screening
   where subject_type = 'firm' and subject_id = p_firm_id and check_type = 'ofac_sdn'
   order by checked_at desc
   limit 1;
  if v_ofac = 'hit' then
    raise exception 'OFAC hit — promote blocked for firm %', p_firm_id;
  end if;

  -- Dedupe cascade, highest confidence first.
  -- 1) firm_stem + state exact match -> update in place.
  select id into v_match
    from public.prospect_investors
   where firm_stem = v_firm.firm_stem
     and coalesce(state_or_country, '') = coalesce(v_firm.state_or_country, '')
   limit 1;

  -- 2) domain match -> update in place.
  if v_match is null and v_firm.domain is not null then
    select id into v_match from public.prospect_investors where domain = v_firm.domain limit 1;
  end if;

  -- 3) normalized name >= 60% -> held for review, never auto-applied.
  if v_match is null then
    if exists (
      select 1 from public.prospect_investors
       where similarity(lower(name), lower(v_firm.display_name)) >= 0.6
    ) then
      return jsonb_build_object('action', 'review', 'firm_id', p_firm_id);
    end if;
  end if;

  if v_match is not null then
    update public.prospect_investors set
      investor_type    = coalesce(investor_type, 'Fund'),
      preferred_sectors = coalesce(v_firm.sectors_observed, preferred_sectors),
      check_size_max   = coalesce(v_firm.est_check_size, check_size_max),
      source           = 'SEC Form D',
      source_ref       = p_firm_id::text,
      status           = coalesce(status, 'New'),
      lawful_basis     = p_lawful_basis,
      activity_band    = v_firm.activity_band,
      domain           = coalesce(domain, v_firm.domain),
      firm_stem        = v_firm.firm_stem,
      state_or_country = v_firm.state_or_country,
      updated_at       = now()
    where id = v_match;
    v_action := 'matched';
  else
    insert into public.prospect_investors (
      name, investor_type, preferred_sectors, check_size_max,
      source, source_ref, status, lawful_basis, activity_band, domain,
      firm_stem, state_or_country, segment, notes
    ) values (
      v_firm.display_name, 'Fund', coalesce(v_firm.sectors_observed, '{}'), v_firm.est_check_size,
      'SEC Form D', p_firm_id::text, 'New', p_lawful_basis, v_firm.activity_band, v_firm.domain,
      v_firm.firm_stem, v_firm.state_or_country, 'distribution',
      'Promoted from SEC Form D. Reg D raised (not AUM): ' || coalesce(v_firm.regd_footprint::text, 'n/a')
    ) returning id into v_match;
    v_action := 'created';
  end if;

  update public.formd_firms
     set promoted_at = now(), promoted_investor_id = v_match, updated_at = now()
   where id = p_firm_id;

  return jsonb_build_object('action', v_action, 'prospect_investor_id', v_match);
end;
$$;
