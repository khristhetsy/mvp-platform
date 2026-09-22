-- Registration — the tick that lets a name appear on the public event page.
--
-- The event page and the event email are about to list who is attending. The
-- registration form has never asked permission for that: it collects a name
-- and email so someone can attend, and says nothing about being published
-- somewhere Google can index.
--
-- So the question ships before the list does. Absent means private: nobody
-- already registered is opted in, and the public list will be short at first.
-- That is correct, not broken.
--
-- Registration fields are versioned data, so this is a new active version
-- rather than an edit — the previous one stays readable and revertible, and
-- the question is editable afterwards in Event Hub → Registration → Fields.

do $$
declare
  current_set  public.registration_field_sets%rowtype;
  next_version text;
  added        jsonb;
begin
  select * into current_set
  from public.registration_field_sets
  where is_active
  limit 1;

  -- Nothing seeded yet: the app falls back to the code constants, and this
  -- migration has nothing to append to.
  if current_set.id is null then
    raise notice 'no active registration field set — skipping';
    return;
  end if;

  -- Already asked, however it got there.
  if current_set.by_type::text like '%"listedPublicly"%' then
    raise notice 'listedPublicly already present — skipping';
    return;
  end if;

  added := jsonb_build_object(
    'key',   'listedPublicly',
    'label', 'List my name and badge on the public event page',
    'kind',  'checkbox'
  );

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
    -- Investors and founders only. A sponsor or service provider registers for
    -- a different reason and is not part of the attendee list.
    jsonb_set(
      jsonb_set(
        current_set.by_type,
        '{investor}',
        coalesce(current_set.by_type -> 'investor', '[]'::jsonb) || added
      ),
      '{founder}',
      coalesce(current_set.by_type -> 'founder', '[]'::jsonb) || added
    ),
    false,
    'Ask permission before listing a registrant on the public event page.'
  );

  update public.registration_field_sets set is_active = false where is_active;
  update public.registration_field_sets set is_active = true  where version = next_version;
end $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect one row, is_active true, with the question on investor and founder.
-- select version, is_active,
--        by_type -> 'investor' @> '[{"key":"listedPublicly"}]' as investor_has,
--        by_type -> 'founder'  @> '[{"key":"listedPublicly"}]' as founder_has
-- from public.registration_field_sets where is_active;
