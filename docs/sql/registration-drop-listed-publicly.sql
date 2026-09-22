-- Registration — take back the tick that no longer decides anything.
--
-- 20260922005 added "List my name and badge on the public event page", on the
-- assumption that the attendee list was opt-in. It isn't: registration is the
-- qualifier, so the list shows every registered investor and founder and the
-- tick changes nothing.
--
-- A control that cannot run is not allowed to stay on screen, and a consent
-- question is worse than a dead button — it promises a choice we don't honour.
-- So it comes off the form.
--
-- Field sets are versioned data, so this is a new active version rather than an
-- edit: v2 stays readable, and reverting is a matter of flipping is_active.
-- Answers already collected are left alone in registrations.answers; they are
-- simply not read.

do $$
declare
  current_set  public.registration_field_sets%rowtype;
  next_version text;
  cleaned      jsonb;
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

  if current_set.by_type::text not like '%"listedPublicly"%' then
    raise notice 'listedPublicly not present — skipping';
    return;
  end if;

  -- Drop it wherever it landed, not just from the two roles 005 wrote to: it
  -- may have been copied onto another role in the editor since.
  cleaned := current_set.by_type;
  for role_key in select jsonb_object_keys(current_set.by_type) loop
    cleaned := jsonb_set(
      cleaned,
      array[role_key],
      coalesce(
        (
          select jsonb_agg(f)
          from jsonb_array_elements(current_set.by_type -> role_key) as f
          where f ->> 'key' is distinct from 'listedPublicly'
        ),
        '[]'::jsonb
      )
    );
  end loop;

  -- The next *free* label, not count+1: versions can be reverted, skipped or
  -- created out of order, so counting rows is not the same as counting names.
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
    cleaned,
    false,
    'Registration is the qualifier for the attendee list; the opt-in tick decided nothing.'
  );

  update public.registration_field_sets set is_active = false where is_active;
  update public.registration_field_sets set is_active = true  where version = next_version;
end $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect one active row, and false on both columns.
-- select version, is_active,
--        by_type -> 'investor' @> '[{"key":"listedPublicly"}]' as investor_has,
--        by_type -> 'founder'  @> '[{"key":"listedPublicly"}]' as founder_has
-- from public.registration_field_sets where is_active;
