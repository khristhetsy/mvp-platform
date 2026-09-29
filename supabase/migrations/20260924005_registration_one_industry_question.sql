-- Registration — one Industry question (2026-09-24).
--
-- Founders and investors were asked about sector twice: once in their role's
-- fields ("Sector" / "Sectors of interest") and again in a separate required
-- "Networking interests" block drawn from the same event sector list. Both
-- answers fed the same networking match, and the intake already overwrote the
-- second with the first. The form now asks once, labelled "Industry", and
-- uses that answer for networking interests.
--
-- Only the label changes here. The keys (sector / sectors) and the option list
-- (the event sector list) stay, so every stored answer and the matching read
-- them exactly as before.
--
-- Field sets are versioned data: this adds a new active version; reverting is
-- flipping is_active back.

do $$
declare
  current_set  public.registration_field_sets%rowtype;
  next_version text;
  relabelled   jsonb;
  role_key     text;
begin
  select * into current_set
  from public.registration_field_sets
  where is_active
  limit 1;

  if current_set.id is null then
    raise notice 'no active registration field set — skipping';
    return;
  end if;

  relabelled := current_set.by_type;
  for role_key in select jsonb_object_keys(current_set.by_type) loop
    relabelled := jsonb_set(
      relabelled,
      array[role_key],
      coalesce(
        (
          select jsonb_agg(
            case
              when f ->> 'key' in ('sector', 'sectors') then jsonb_set(f, '{label}', '"Industry"')
              else f
            end
            order by ord
          )
          from jsonb_array_elements(current_set.by_type -> role_key) with ordinality as t(f, ord)
        ),
        '[]'::jsonb
      )
    );
  end loop;

  if relabelled = current_set.by_type then
    raise notice 'already labelled Industry — skipping';
    return;
  end if;

  select 'reg-fields-v' || n::text
    into next_version
  from generate_series(2, 999) as n
  where not exists (
    select 1 from public.registration_field_sets
    where version = 'reg-fields-v' || n::text
  )
  order by n
  limit 1;

  insert into public.registration_field_sets (version, roles, common, by_type, is_active, reason)
  values (
    next_version,
    current_set.roles,
    current_set.common,
    relabelled,
    false,
    'One Industry question: the sector answer also sets networking interests.'
  );

  update public.registration_field_sets set is_active = false where is_active;
  update public.registration_field_sets set is_active = true  where version = next_version;
end $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select version, is_active,
--        jsonb_path_query_array(by_type, '$.*[*] ? (@.key == "sector" || @.key == "sectors").label') as labels
-- from public.registration_field_sets where is_active;
