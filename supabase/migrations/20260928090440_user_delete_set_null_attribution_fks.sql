-- Deleting a user failed ("Database error deleting user") because optional
-- attribution columns pointed at the user with ON DELETE NO ACTION. Clear the
-- attribution instead of blocking the delete. Required (NOT NULL) owner columns
-- are left as-is on purpose: those deletes stay blocked until the records are
-- reassigned.
do $$
declare
  r record;
  names text[] := array[
    'ceo_kpi_meeting_agent_entries_entered_by_fkey',
    'companies_offering_type_attested_by_fkey',
    'crr_weight_sets_created_by_fkey',
    'data_room_access_granted_by_fkey',
    'event_brochures_created_by_fkey',
    'event_email_drafts_updated_by_fkey',
    'event_intro_templates_updated_by_fkey',
    'event_introductions_created_by_fkey',
    'event_introductions_scheduled_by_fkey',
    'event_matching_rules_updated_by_fkey',
    'ir_activities_assignee_id_fkey',
    'ir_goals_assignee_id_fkey',
    'ir_goals_created_by_fkey',
    'ir_match_stage_events_changed_by_fkey',
    'ir_matches_assignee_id_fkey',
    'ir_matches_created_by_fkey',
    'ir_reports_approved_by_fkey',
    'ir_tasks_assignee_id_fkey',
    'marketplace_listings_reviewed_by_fkey',
    'organizations_created_by_fkey',
    'partner_score_weights_updated_by_fkey',
    'pricing_sets_created_by_fkey',
    'registration_field_sets_created_by_fkey',
    'sales_bulk_assign_audit_actor_id_fkey'
  ];
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col,
           c.confrelid::regclass as ref, af.attname as refcol
    from pg_constraint c
    join pg_attribute a  on a.attrelid = c.conrelid  and a.attnum = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f' and c.conname = any(names) and c.confdeltype in ('a','r')
      and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s(%I) on delete set null',
                   r.tbl, r.conname, r.col, r.ref, r.refcol);
  end loop;
end $$;
