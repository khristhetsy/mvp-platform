-- One place that turns a Contacts filter spec into SQL.
--
-- Until now every filter was compiled in TypeScript into PostgREST URL strings
-- (`or=(profile.cs."{\"investorTypes\":[...]}",...)`) by four different endpoints with
-- three quoting conventions. Values with commas, parens or quotes broke the request or
-- were silently dropped, and the list / header counts / group counts / bulk "select all"
-- each rebuilt the predicate separately, so they could disagree.
--
-- Here the spec arrives as jsonb and every value goes through quote_literal / format(%L),
-- so no value ever touches URL grammar. The same WHERE serves rows, counts and buckets.
--
--   spec = { "match": "all"|"any", "conditions": [ { "field", "op", "value" }, ... ] }
--   fields: q | name | company | email | phone | country | type | leadSource
--           | industries | capital | fundingStages | investorTypes | operatingStages
--           | createdAt | assignee
--   ops:    contains | equals | in | set | not_set | after | before
--
-- Unknown field/op → exception (a broken saved view must show as an error, not as "no
-- contacts"). group_value '__none__' means the "Unassigned" bucket.

create or replace function public.contacts_spec_where(
  p_spec        jsonb,
  p_owner       uuid,
  p_group_by    text,
  p_group_value text
) returns text
language plpgsql immutable as $$
declare
  cond      jsonb;
  field     text;
  op        text;
  vals      text[];
  v         text;
  parts     text[] := '{}';
  term      text;
  terms     text[];
  facet_key text;
  match_any boolean := coalesce(p_spec->>'match', 'all') = 'any';
  where_sql text;
  none      constant text := '__none__';
  y int; m int;
begin
  -- ── Spec conditions ─────────────────────────────────────────────────────
  for cond in select * from jsonb_array_elements(coalesce(p_spec->'conditions', '[]'::jsonb)) loop
    field := cond->>'field';
    op    := cond->>'op';
    -- value may be a string or an array of strings
    if jsonb_typeof(cond->'value') = 'array' then
      select coalesce(array_agg(trim(x)) filter (where trim(x) <> ''), '{}') into vals
        from jsonb_array_elements_text(cond->'value') x;
    elsif cond->>'value' is not null and trim(cond->>'value') <> '' then
      vals := array[trim(cond->>'value')];
    else
      vals := '{}';
    end if;
    v := vals[1];
    term := null;

    case field
      when 'q' then
        if v is null then continue; end if;
        term := format('(name ilike %1$L or email ilike %1$L or company ilike %1$L or phone ilike %1$L)',
                       '%' || regexp_replace(v, '([%_\\])', '\\\1', 'g') || '%');

      when 'name', 'company', 'email', 'phone' then
        case op
          when 'contains' then
            if v is null then continue; end if;
            term := format('%I ilike %L', field, '%' || regexp_replace(v, '([%_\\])', '\\\1', 'g') || '%');
          when 'equals' then
            if v is null then continue; end if;
            term := format('%I ilike %L', field, regexp_replace(v, '([%_\\])', '\\\1', 'g'));
          when 'set'     then term := format('(%I is not null and %I <> '''')', field, field);
          when 'not_set' then term := format('(%I is null or %I = '''')', field, field);
          else raise exception 'contacts filter: unsupported op % for %', op, field;
        end case;

      when 'country' then
        case op
          when 'in'      then if cardinality(vals) = 0 then continue; end if;
                              term := format('country = any(%L::text[])', vals);
          when 'set'     then term := '(country is not null and country <> '''')';
          when 'not_set' then term := '(country is null or country = '''')';
          else raise exception 'contacts filter: unsupported op % for country', op;
        end case;

      when 'type' then
        if op <> 'in' then raise exception 'contacts filter: unsupported op % for type', op; end if;
        if cardinality(vals) = 0 then continue; end if;
        term := format('(contact_type = any(%1$L::text[]) or module = any(%1$L::text[]))', vals);

      when 'leadSource' then
        case op
          when 'in'  then if cardinality(vals) = 0 then continue; end if;
                          term := format('((overrides->>''lead_source'') = any(%1$L::text[]) or (profile->>''leadSource'') = any(%1$L::text[]))', vals);
          when 'set' then term := '((overrides->>''lead_source'') is not null or (profile->>''leadSource'') is not null)';
          else raise exception 'contacts filter: unsupported op % for leadSource', op;
        end case;

      when 'industries', 'capital', 'fundingStages', 'investorTypes', 'operatingStages' then
        facet_key := field;
        case op
          when 'in' then
            if cardinality(vals) = 0 then continue; end if;
            -- OR of root containments: each one is served by the profile GIN (BitmapOr).
            terms := '{}';
            foreach v in array vals loop
              terms := terms || format('profile @> %L::jsonb', jsonb_build_object(facet_key, jsonb_build_array(v))::text);
            end loop;
            term := '(' || array_to_string(terms, ' or ') || ')';
          when 'set' then
            term := format('(profile->%L is not null and profile->%L <> ''[]''::jsonb)', facet_key, facet_key);
          else raise exception 'contacts filter: unsupported op % for %', op, field;
        end case;

      when 'createdAt' then
        if v is null then continue; end if;
        case op
          when 'after'  then term := format('created_on >= %L', v);
          when 'before' then term := format('created_on <= %L', v);
          else raise exception 'contacts filter: unsupported op % for createdAt', op;
        end case;

      when 'assignee' then
        case op
          when 'set'     then term := '(assignee_ids is not null and cardinality(assignee_ids) > 0)';
          when 'not_set' then term := '(assignee_ids is null or cardinality(assignee_ids) = 0)';
          else raise exception 'contacts filter: unsupported op % for assignee', op;
        end case;

      else
        raise exception 'contacts filter: unknown field %', field;
    end case;

    if term is not null then parts := parts || term; end if;
  end loop;

  if cardinality(parts) = 0 then
    where_sql := 'true';
  elsif match_any then
    where_sql := '(' || array_to_string(parts, ' or ') || ')';
  else
    where_sql := '(' || array_to_string(parts, ' and ') || ')';
  end if;

  -- ── Owner scope (Lead-assigned contacts only, unless null = see all) ─────
  if p_owner is not null then
    where_sql := where_sql || format(' and assignee_ids @> array[%L::uuid]', p_owner);
  end if;

  -- ── Group bucket (paging within one group) ──────────────────────────────
  if p_group_by is not null and p_group_value is not null then
    case p_group_by
      when 'profile' then
        if p_group_value in ('founder', 'investor', 'advisor') then
          where_sql := where_sql || format(' and (contact_type = %1$L or module = %1$L)', p_group_value);
        else
          where_sql := where_sql || ' and lower(coalesce(nullif(contact_type, ''''), nullif(module, ''''), ''other'')) not in (''founder'', ''investor'', ''advisor'')';
        end if;
      when 'industries', 'capital', 'fundingStages', 'investorTypes', 'operatingStages' then
        if p_group_value = none then
          where_sql := where_sql || format(' and (profile->%1$L is null or profile->%1$L = ''[]''::jsonb)', p_group_by);
        else
          where_sql := where_sql || format(' and profile @> %L::jsonb', jsonb_build_object(p_group_by, jsonb_build_array(p_group_value))::text);
        end if;
      when 'leadSource' then
        if p_group_value = none then
          where_sql := where_sql || ' and nullif(overrides->>''lead_source'', '''') is null and nullif(profile->>''leadSource'', '''') is null';
        else
          where_sql := where_sql || format(' and coalesce(nullif(overrides->>''lead_source'', ''''), profile->>''leadSource'') = %L', p_group_value);
        end if;
      when 'country', 'company', 'source' then
        if p_group_value = none then
          where_sql := where_sql || format(' and (%I is null or %I = '''')', p_group_by, p_group_by);
        else
          where_sql := where_sql || format(' and %I = %L', p_group_by, p_group_value);
        end if;
      when 'assignees' then
        if p_group_value = none then
          where_sql := where_sql || ' and (assignee_ids is null or cardinality(assignee_ids) = 0)';
        else
          where_sql := where_sql || format(' and assignee_ids @> array[%L::uuid]', p_group_value);
        end if;
      when 'createdMonth' then
        if p_group_value = none then
          where_sql := where_sql || ' and created_on is null';
        else
          y := split_part(p_group_value, '-', 1)::int;
          m := split_part(p_group_value, '-', 2)::int;
          where_sql := where_sql || format(' and created_on >= %L and created_on < %L',
            to_char(make_date(y, m, 1), 'YYYY-MM-DD'), to_char(make_date(y, m, 1) + interval '1 month', 'YYYY-MM-DD'));
        end if;
      else
        raise exception 'contacts filter: unknown group_by %', p_group_by;
    end case;
  end if;

  return where_sql;
end $$;

-- Rows for one page + the exact total for the same predicate.
create or replace function public.search_contacts(
  p_spec        jsonb,
  p_owner       uuid     default null,
  p_group_by    text     default null,
  p_group_value text     default null,
  p_sort        text     default 'name',
  p_dir         text     default 'asc',
  p_offset      int      default 0,
  p_limit       int      default 50
) returns table (
  id uuid, name text, email text, company text, phone text, source text, external_id text,
  contact_type text, country text, created_on text, synced_at timestamptz, assignee_ids uuid[],
  raw_phone text, raw_mobile text, ls_profile text, ls_override text, total bigint
)
language plpgsql stable as $$
declare
  where_sql text := public.contacts_spec_where(p_spec, p_owner, p_group_by, p_group_value);
  sort_col  text := case when p_sort in ('name', 'company', 'email', 'country', 'created_on') then p_sort else 'name' end;
  sort_dir  text := case when lower(p_dir) = 'desc' then 'desc' else 'asc' end;
begin
  return query execute format($q$
    select c.id, c.name, c.email, c.company, c.phone, c.source, c.external_id,
           c.contact_type, c.country, c.created_on, c.synced_at, c.assignee_ids,
           c.raw->>'phone', c.raw->>'mobile', c.profile->>'leadSource', c.overrides->>'lead_source',
           count(*) over() as total
      from public.crm_contacts c
     where %s
     order by c.%I %s nulls last, c.id
    offset %s limit %s
  $q$, where_sql, sort_col, sort_dir, greatest(p_offset, 0), least(greatest(p_limit, 1), 200));
end $$;

-- Bucket counts for one group-by dimension over the same predicate — one query instead
-- of an 80-page scan plus 80 count queries. value '__none__' = Unassigned.
create or replace function public.count_contact_buckets(
  p_spec     jsonb,
  p_owner    uuid default null,
  p_group_by text default 'profile'
) returns table (value text, n bigint)
language plpgsql stable as $$
declare
  where_sql text := public.contacts_spec_where(p_spec, p_owner, null, null);
  bucket    text;
begin
  case p_group_by
    when 'profile' then
      bucket := $b$ (select case when lower(coalesce(nullif(c.contact_type, ''), nullif(c.module, ''), 'other')) in ('founder','investor','advisor')
                            then lower(coalesce(nullif(c.contact_type, ''), nullif(c.module, ''), 'other')) else 'other' end) $b$;
    when 'industries', 'capital', 'fundingStages', 'investorTypes', 'operatingStages' then
      bucket := format($b$ unnest(case when jsonb_typeof(c.profile->%1$L) = 'array' and jsonb_array_length(c.profile->%1$L) > 0
                                   then (select array_agg(x) from jsonb_array_elements_text(c.profile->%1$L) x)
                                   else array['__none__'] end) $b$, p_group_by);
    when 'leadSource' then
      bucket := $b$ coalesce(nullif(c.overrides->>'lead_source', ''), nullif(c.profile->>'leadSource', ''), '__none__') $b$;
    when 'country', 'company', 'source' then
      bucket := format($b$ coalesce(nullif(c.%I, ''), '__none__') $b$, p_group_by);
    when 'assignees' then
      bucket := $b$ unnest(case when c.assignee_ids is null or cardinality(c.assignee_ids) = 0 then array['__none__'] else c.assignee_ids::text[] end) $b$;
    when 'createdMonth' then
      bucket := $b$ coalesce(nullif(substr(c.created_on, 1, 7), ''), '__none__') $b$;
    else
      raise exception 'contacts buckets: unknown group_by %', p_group_by;
  end case;

  return query execute format($q$
    select b.value, count(*)::bigint
      from public.crm_contacts c, lateral (select %s as value) b
     where %s
     group by b.value
     order by (b.value = '__none__'), count(*) desc, b.value
  $q$, bucket, where_sql);
end $$;

-- Every matching id (bulk actions' "Select all N"), capped.
create or replace function public.search_contact_ids(
  p_spec        jsonb,
  p_owner       uuid default null,
  p_group_by    text default null,
  p_group_value text default null,
  p_limit       int  default 25000
) returns setof uuid
language plpgsql stable as $$
begin
  return query execute format('select c.id from public.crm_contacts c where %s order by c.id limit %s',
    public.contacts_spec_where(p_spec, p_owner, p_group_by, p_group_value), least(greatest(p_limit, 1), 25000));
end $$;

revoke all on function public.contacts_spec_where(jsonb, uuid, text, text) from public, anon, authenticated;
revoke all on function public.search_contacts(jsonb, uuid, text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.count_contact_buckets(jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.search_contact_ids(jsonb, uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.contacts_spec_where(jsonb, uuid, text, text) to service_role;
grant execute on function public.search_contacts(jsonb, uuid, text, text, text, text, int, int) to service_role;
grant execute on function public.count_contact_buckets(jsonb, uuid, text) to service_role;
grant execute on function public.search_contact_ids(jsonb, uuid, text, text, int) to service_role;
