-- Merge duplicate crm_contacts (Sales Hub Contacts → Actions → Merge) and undo a merge.
--
-- merge_crm_contacts(keep, merge[], fields, by):
--   * copies the chosen field values onto the kept contact (fields = {"name": <contact id>, ...};
--     supported: name, company, email, phone, website, type, profile)
--   * unions tags and lead assignees
--   * moves every reference (IR matches, IR projects, marketing contacts, enrichment, match
--     campaigns, publish events, Form D promotions, assessment leads) to the kept contact.
--     When the kept contact already has an IR match on the same project, the two matches
--     become one and the removed match's activities, notes, stage history and sequences move.
--   * writes one contact_merges row per removed contact (same batch_id) holding the removed
--     row, the kept row before the merge, and the ids of everything that moved, then deletes it.
-- undo_contact_merge(batch) reverses one batch, provided nothing merged into the kept contact since.
--
-- contact_type, country and created_on are generated from module / plan / raw, so "type" copies
-- module + plan, and "profile" copies raw.__profile plus the override keys the profile trigger reads.

alter table public.contact_merges add column if not exists batch_id uuid;
alter table public.contact_merges add column if not exists merged_source text generated always as (merged_row->>'source') stored;
alter table public.contact_merges add column if not exists merged_external_id text generated always as (merged_row->>'external_id') stored;
update public.contact_merges set batch_id = id where batch_id is null;
alter table public.contact_merges alter column batch_id set not null;
create index if not exists contact_merges_batch_idx on public.contact_merges(batch_id);
-- The Odoo sync skips (source, external_id) pairs that were merged away, so they don't come back.
create index if not exists contact_merges_tombstone_idx on public.contact_merges(merged_source, merged_external_id) where undone_at is null;

-- Staff can read the merge log (the app writes it through the functions below, as service role).
drop policy if exists contact_merges_staff_read on public.contact_merges;
create policy contact_merges_staff_read
  on public.contact_merges for select
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('admin', 'analyst')
  ));

create or replace function public.merge_crm_contacts(
  p_keep   uuid,
  p_merge  uuid[],
  p_fields jsonb default '{}'::jsonb,
  p_by     uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  batch   uuid := gen_random_uuid();
  k       public.crm_contacts;
  m       public.crm_contacts;
  src     public.crm_contacts;
  before  jsonb;
  mid     uuid;
  moved   jsonb;
  ids     jsonb;
  pairs   jsonb;
  f       text;
  chosen  uuid;
  totals  jsonb := '{}'::jsonb;
  n_merged int := 0;
begin
  if p_keep is null or p_merge is null or cardinality(p_merge) = 0 then
    raise exception 'Pick a contact to keep and at least one to merge in.';
  end if;
  if p_keep = any(p_merge) then raise exception 'The kept contact can''t also be merged in.'; end if;
  if cardinality(p_merge) > 9 then raise exception 'Merge at most 10 contacts at a time.'; end if;

  select * into k from public.crm_contacts where id = p_keep for update;
  if not found then raise exception 'The contact to keep no longer exists.'; end if;
  perform 1 from public.crm_contacts where id = any(p_merge) for update;
  if (select count(*) from public.crm_contacts where id = any(p_merge)) <> cardinality(p_merge) then
    raise exception 'One of the contacts to merge no longer exists. Refresh and try again.';
  end if;
  before := to_jsonb(k);

  -- ── Field choices ─────────────────────────────────────────────────────────
  for f, chosen in select key, (value #>> '{}')::uuid from jsonb_each(coalesce(p_fields, '{}'::jsonb)) loop
    if chosen is null or chosen = p_keep then continue; end if;
    if not (chosen = any(p_merge)) then raise exception 'Field % points at a contact outside this merge.', f; end if;
    select * into src from public.crm_contacts where id = chosen;
    case f
      when 'name'    then update public.crm_contacts set name = src.name where id = p_keep;
      when 'company' then update public.crm_contacts set company = src.company where id = p_keep;
      when 'email'   then update public.crm_contacts set email = src.email, email_status = src.email_status, email_source = src.email_source where id = p_keep;
      when 'phone'   then update public.crm_contacts set phone = src.phone, phone_source = src.phone_source where id = p_keep;
      when 'website' then update public.crm_contacts set website = src.website where id = p_keep;
      when 'type'    then update public.crm_contacts set module = src.module, plan = src.plan where id = p_keep;
      when 'profile' then
        update public.crm_contacts
           set raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{__profile}', coalesce(src.raw -> '__profile', src.profile, '{}'::jsonb)),
               overrides = coalesce(overrides, '{}'::jsonb) || coalesce(src.overrides, '{}'::jsonb)
         where id = p_keep;
      else raise exception 'Unknown merge field %', f;
    end case;
  end loop;

  -- Overrides the kept contact doesn't have yet, tags and assignees: union.
  update public.crm_contacts c
     set overrides = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                        from (select key, value, 1 as pri from jsonb_each(coalesce(c.overrides, '{}'::jsonb))
                              union all
                              select o.key, o.value, 2 from public.crm_contacts x, jsonb_each(coalesce(x.overrides, '{}'::jsonb)) o where x.id = any(p_merge)) e
                       where e.pri = 1 or not coalesce(c.overrides, '{}'::jsonb) ? e.key),
         tags = (select coalesce(array_agg(distinct t), '{}') from (select unnest(coalesce(c.tags, '{}')) t union select unnest(coalesce(x.tags, '{}')) from public.crm_contacts x where x.id = any(p_merge)) z where t is not null and t <> ''),
         assignee_ids = (select coalesce(array_agg(distinct a), '{}') from (select unnest(coalesce(c.assignee_ids, '{}')) a union select unnest(coalesce(x.assignee_ids, '{}')) from public.crm_contacts x where x.id = any(p_merge)) z where a is not null),
         owner_id = coalesce(c.owner_id, (select x.owner_id from public.crm_contacts x where x.id = any(p_merge) and x.owner_id is not null limit 1))
   where c.id = p_keep;

  -- ── Move references, one removed contact at a time ────────────────────────
  foreach mid in array p_merge loop
    select * into m from public.crm_contacts where id = mid;
    moved := '{}'::jsonb;

    -- IR matches on a project the kept contact is already on: fold into the kept match.
    select coalesce(jsonb_agg(jsonb_build_object('from', l.id, 'into', kk.id, 'row', to_jsonb(l),
             'ir_activities', (select coalesce(jsonb_agg(a.id), '[]') from public.ir_activities a where a.match_id = l.id),
             'ir_notes', (select coalesce(jsonb_agg(a.id), '[]') from public.ir_notes a where a.match_id = l.id),
             'ir_match_stage_events', (select coalesce(jsonb_agg(a.id), '[]') from public.ir_match_stage_events a where a.match_id = l.id),
             'ir_sequence_enrollments', (select coalesce(jsonb_agg(a.id), '[]') from public.ir_sequence_enrollments a where a.match_id = l.id),
             'ir_sequence_events', (select coalesce(jsonb_agg(a.id), '[]') from public.ir_sequence_events a where a.match_id = l.id))), '[]')
      into pairs
      from public.ir_matches l join public.ir_matches kk on kk.project_id = l.project_id and kk.investor_contact_id = p_keep
     where l.investor_contact_id = mid;
    if jsonb_array_length(pairs) > 0 then
      update public.ir_activities a set match_id = (p->>'into')::uuid from jsonb_array_elements(pairs) p where a.match_id = (p->>'from')::uuid;
      update public.ir_notes a set match_id = (p->>'into')::uuid from jsonb_array_elements(pairs) p where a.match_id = (p->>'from')::uuid;
      update public.ir_match_stage_events a set match_id = (p->>'into')::uuid from jsonb_array_elements(pairs) p where a.match_id = (p->>'from')::uuid;
      update public.ir_sequence_enrollments a set match_id = (p->>'into')::uuid from jsonb_array_elements(pairs) p where a.match_id = (p->>'from')::uuid;
      update public.ir_sequence_events a set match_id = (p->>'into')::uuid from jsonb_array_elements(pairs) p where a.match_id = (p->>'from')::uuid;
      delete from public.ir_matches x using jsonb_array_elements(pairs) p where x.id = (p->>'from')::uuid;
      moved := moved || jsonb_build_object('ir_match_merges', pairs);
    end if;

    with u as (update public.ir_matches set investor_contact_id = p_keep where investor_contact_id = mid returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('ir_matches', ids);
    with u as (update public.ir_projects set founder_contact_id = p_keep where founder_contact_id = mid returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('ir_projects', ids);
    with u as (update public.marketing_contacts set crm_contact_id = p_keep where crm_contact_id = mid returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('marketing_contacts', ids);
    with u as (update public.publish_events set contact_id = p_keep where contact_id = mid returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('publish_events', ids);
    with u as (update public.formd_filings set promoted_contact_id = p_keep where promoted_contact_id = mid returning accession_no)
    select coalesce(jsonb_agg(accession_no), '[]') into ids from u; moved := moved || jsonb_build_object('formd_filings', ids);
    with u as (update public.assessment_leads set converted_contact_id = p_keep where converted_contact_id = mid returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('assessment_leads', ids);

    -- One enrichment row per contact: move it if the kept contact has none, else keep a copy for undo.
    if exists (select 1 from public.investor_enrichment where contact_id = p_keep) then
      select coalesce(jsonb_agg(to_jsonb(e)), '[]') into ids from public.investor_enrichment e where e.contact_id = mid;
      moved := moved || jsonb_build_object('investor_enrichment_dropped', ids);
    else
      with u as (update public.investor_enrichment set contact_id = p_keep where contact_id = mid returning id)
      select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('investor_enrichment', ids);
    end if;

    -- Match campaigns: move unless the kept contact is already in that campaign / founder slot.
    select coalesce(jsonb_agg(to_jsonb(x)), '[]') into ids from public.match_campaign_matches x
     where x.investor_contact_id = mid and exists (select 1 from public.match_campaign_matches y where y.campaign_founder_id = x.campaign_founder_id and y.investor_contact_id = p_keep);
    moved := moved || jsonb_build_object('match_campaign_matches_dropped', ids);
    with u as (update public.match_campaign_matches x set investor_contact_id = p_keep where x.investor_contact_id = mid
               and not exists (select 1 from public.match_campaign_matches y where y.campaign_founder_id = x.campaign_founder_id and y.investor_contact_id = p_keep) returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('match_campaign_matches', ids);
    select coalesce(jsonb_agg(to_jsonb(x)), '[]') into ids from public.match_campaign_founders x
     where x.founder_contact_id = mid and exists (select 1 from public.match_campaign_founders y where y.campaign_id = x.campaign_id and y.founder_contact_id = p_keep);
    moved := moved || jsonb_build_object('match_campaign_founders_dropped', ids);
    with u as (update public.match_campaign_founders x set founder_contact_id = p_keep where x.founder_contact_id = mid
               and not exists (select 1 from public.match_campaign_founders y where y.campaign_id = x.campaign_id and y.founder_contact_id = p_keep) returning id)
    select coalesce(jsonb_agg(id), '[]') into ids from u; moved := moved || jsonb_build_object('match_campaign_founders', ids);

    insert into public.contact_merges (batch_id, kept_id, merged_id, merged_row, kept_before, moved, reason, merged_by)
    values (batch, p_keep, mid, to_jsonb(m), before, moved, 'Merged in Sales Hub Contacts', p_by);

    delete from public.investor_match_index where contact_id = mid;
    delete from public.crm_contacts where id = mid;   -- remaining cascades only hit rows copied above
    n_merged := n_merged + 1;

    totals := jsonb_build_object(
      'ir_matches', coalesce((totals->>'ir_matches')::int, 0) + jsonb_array_length(moved->'ir_matches') + jsonb_array_length(coalesce(moved->'ir_match_merges', '[]')),
      'lists', coalesce((totals->>'lists')::int, 0) + jsonb_array_length(moved->'marketing_contacts'),
      'projects', coalesce((totals->>'projects')::int, 0) + jsonb_array_length(moved->'ir_projects'));
  end loop;

  return jsonb_build_object('batchId', batch, 'keptId', p_keep, 'merged', n_merged, 'moved', totals);
end $$;

create or replace function public.undo_contact_merge(p_batch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r      public.contact_merges;
  keep   uuid;
  kb     jsonb;
  cols   text;
  p      jsonb;
  n      int := 0;
begin
  select kept_id, kept_before into keep, kb from public.contact_merges where batch_id = p_batch and undone_at is null limit 1;
  if keep is null then raise exception 'That merge was already undone or doesn''t exist.'; end if;
  if exists (select 1 from public.contact_merges where kept_id = keep and undone_at is null and batch_id <> p_batch
               and created_at > (select max(created_at) from public.contact_merges where batch_id = p_batch)) then
    raise exception 'Another merge into this contact happened later. Undo that one first.';
  end if;
  perform 1 from public.crm_contacts where id = keep for update;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'crm_contacts' and is_generated = 'NEVER';

  for r in select * from public.contact_merges where batch_id = p_batch and undone_at is null loop
    if exists (select 1 from public.crm_contacts where id = r.merged_id) then
      raise exception 'Contact % already exists again; can''t undo.', r.merged_id;
    end if;
    execute format('insert into public.crm_contacts (%1$s) select %1$s from jsonb_populate_record(null::public.crm_contacts, $1)', cols) using r.merged_row;

    update public.ir_matches set investor_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'ir_matches'))::uuid);
    for p in select * from jsonb_array_elements(coalesce(r.moved->'ir_match_merges', '[]')) loop
      insert into public.ir_matches select * from jsonb_populate_record(null::public.ir_matches, p->'row');
      update public.ir_activities set match_id = (p->>'from')::uuid where id in (select (jsonb_array_elements_text(p->'ir_activities'))::uuid);
      update public.ir_notes set match_id = (p->>'from')::uuid where id in (select (jsonb_array_elements_text(p->'ir_notes'))::uuid);
      update public.ir_match_stage_events set match_id = (p->>'from')::uuid where id in (select (jsonb_array_elements_text(p->'ir_match_stage_events'))::bigint);
      update public.ir_sequence_enrollments set match_id = (p->>'from')::uuid where id in (select (jsonb_array_elements_text(p->'ir_sequence_enrollments'))::uuid);
      update public.ir_sequence_events set match_id = (p->>'from')::uuid where id in (select (jsonb_array_elements_text(p->'ir_sequence_events'))::uuid);
    end loop;
    update public.ir_projects set founder_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'ir_projects'))::uuid);
    update public.marketing_contacts set crm_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'marketing_contacts'))::uuid);
    update public.publish_events set contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'publish_events'))::uuid);
    update public.formd_filings set promoted_contact_id = r.merged_id where accession_no in (select jsonb_array_elements_text(r.moved->'formd_filings'));
    update public.assessment_leads set converted_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'assessment_leads'))::uuid);
    update public.investor_enrichment set contact_id = r.merged_id where id in (select (jsonb_array_elements_text(coalesce(r.moved->'investor_enrichment', '[]')))::uuid);
    insert into public.investor_enrichment select * from jsonb_populate_recordset(null::public.investor_enrichment, coalesce(r.moved->'investor_enrichment_dropped', '[]'));
    update public.match_campaign_matches set investor_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'match_campaign_matches'))::uuid);
    update public.match_campaign_founders set founder_contact_id = r.merged_id where id in (select (jsonb_array_elements_text(r.moved->'match_campaign_founders'))::uuid);
    insert into public.match_campaign_founders select * from jsonb_populate_recordset(null::public.match_campaign_founders, coalesce(r.moved->'match_campaign_founders_dropped', '[]'));
    insert into public.match_campaign_matches select * from jsonb_populate_recordset(null::public.match_campaign_matches, coalesce(r.moved->'match_campaign_matches_dropped', '[]'));

    update public.contact_merges set undone_at = now() where id = r.id;
    n := n + 1;
  end loop;

  -- Kept contact back to how it was before this batch.
  update public.crm_contacts c set
    name = kb->>'name', company = kb->>'company', email = kb->>'email', email_status = kb->>'email_status', email_source = kb->>'email_source',
    phone = kb->>'phone', phone_source = kb->>'phone_source', website = kb->>'website', module = kb->>'module', plan = kb->>'plan',
    raw = kb->'raw', overrides = coalesce(kb->'overrides', '{}'::jsonb),
    tags = coalesce((select array_agg(x) from jsonb_array_elements_text(kb->'tags') x), '{}'),
    assignee_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(kb->'assignee_ids') x), '{}'),
    owner_id = (kb->>'owner_id')::uuid
  where c.id = keep;

  return jsonb_build_object('keptId', keep, 'restored', n);
end $$;

revoke all on function public.merge_crm_contacts(uuid, uuid[], jsonb, uuid) from public, anon, authenticated;
revoke all on function public.undo_contact_merge(uuid) from public, anon, authenticated;
grant execute on function public.merge_crm_contacts(uuid, uuid[], jsonb, uuid) to service_role;
grant execute on function public.undo_contact_merge(uuid) to service_role;

-- Duplicate groups by email for the Contacts "Duplicates" view, largest groups first, one row per
-- group with the members as json. Only real addresses (containing @) count: Odoo holds placeholder
-- text such as "email undeliverable" on dozens of rows. The partial covering index makes the
-- grouping an index-only scan (~14 ms warm on production vs ~11 s through the heap).
create index if not exists crm_contacts_email_dupes_idx on public.crm_contacts (lower(email)) include (email) where email like '%@%';

create or replace function public.contact_duplicate_groups(p_q text default null, p_offset int default 0, p_limit int default 25)
returns table (email text, n int, total_groups bigint, total_extra bigint, members jsonb)
language sql stable security definer set search_path = public as $$
  with g as (
    select lower(c.email) e, count(*)::int n
      from public.crm_contacts c
     where c.email like '%@%'
     group by lower(c.email)
    having count(*) > 1
  ), f as (
    select g.*, count(*) over () tg, sum(g.n - 1) over () te from g
     where p_q is null or p_q = '' or g.e ilike '%' || p_q || '%'
        or exists (select 1 from public.crm_contacts c where lower(c.email) = g.e and (c.name ilike '%' || p_q || '%' or c.company ilike '%' || p_q || '%'))
     order by g.n desc, g.e
    offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100)
  )
  select f.e, f.n, f.tg, f.te,
         (select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'company', c.company, 'email', c.email, 'phone', c.phone,
                   'type', c.contact_type, 'source', c.source, 'createdOn', c.created_on,
                   'profileFields', (select count(*) from jsonb_each(coalesce(c.profile, '{}'::jsonb)) j
                                      where j.key in ('investorTypes','industries','fundingStages','operatingStages','capital','businessEntity')
                                        and (case when jsonb_typeof(j.value) = 'array' then jsonb_array_length(j.value) else 0 end) > 0))
                   order by c.created_on nulls last)
            from public.crm_contacts c where lower(c.email) = f.e) members
    from f order by f.n desc, f.e
$$;
revoke all on function public.contact_duplicate_groups(text, int, int) from public, anon, authenticated;
grant execute on function public.contact_duplicate_groups(text, int, int) to service_role;
