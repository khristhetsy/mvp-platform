-- Contacts search: "Sales opportunity" filter and group by (all contact searches:
-- Sales Hub and Marketing Contacts, IR "Search all investors").
--   filter  { field: "salesOpp", op: "set" | "not_set" }  in / not in the sales pipeline
--   group   salesOpp → in_pipeline | not_in_pipeline
-- A contact is in the pipeline when any sales opportunity links to it by
-- contact_crm_id, or (for the few opportunities without that link) by email.
-- Any status counts (open, won, lost). Re-creates contacts_spec_where and
-- count_contact_buckets from 20260914005 with the new branches added.

create index if not exists idx_sales_opportunities_contact_crm_id
  on public.sales_opportunities (contact_crm_id) where contact_crm_id is not null;
create index if not exists idx_sales_opportunities_contact_email_lower
  on public.sales_opportunities (lower(contact_email)) where contact_email is not null;

create or replace function public.contact_in_sales_pipeline(p_id uuid, p_email text)
returns boolean language sql stable as $fn$
  select exists (select 1 from public.sales_opportunities o where o.contact_crm_id = p_id::text)
      or (nullif(trim(p_email), '') is not null
          and exists (select 1 from public.sales_opportunities o where lower(o.contact_email) = lower(trim(p_email))));
$fn$;

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
        term := format('public.contact_role(contact_type, module) = any(%L::text[])', vals);

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

      when 'salesOpp' then
        case op
          when 'set'     then term := 'public.contact_in_sales_pipeline(id, email)';
          when 'not_set' then term := 'not public.contact_in_sales_pipeline(id, email)';
          else raise exception 'contacts filter: unsupported op % for salesOpp', op;
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
        where_sql := where_sql || format(' and public.contact_role(contact_type, module) = %L', p_group_value);
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
      when 'salesOpp' then
        if p_group_value = 'in_pipeline' then
          where_sql := where_sql || ' and public.contact_in_sales_pipeline(id, email)';
        else
          where_sql := where_sql || ' and not public.contact_in_sales_pipeline(id, email)';
        end if;
      else
        raise exception 'contacts filter: unknown group_by %', p_group_by;
    end case;
  end if;

  return where_sql;
end $$;

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
      bucket := 'public.contact_role(c.contact_type, c.module)';
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
    when 'salesOpp' then
      bucket := $b$ case when public.contact_in_sales_pipeline(c.id, c.email) then 'in_pipeline' else 'not_in_pipeline' end $b$;
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


revoke all on function public.contact_in_sales_pipeline(uuid, text) from public, anon, authenticated;
revoke all on function public.contacts_spec_where(jsonb, uuid, text, text) from public, anon, authenticated;
revoke all on function public.count_contact_buckets(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.contact_in_sales_pipeline(uuid, text) to service_role;
grant execute on function public.contacts_spec_where(jsonb, uuid, text, text) to service_role;
grant execute on function public.count_contact_buckets(jsonb, uuid, text) to service_role;
