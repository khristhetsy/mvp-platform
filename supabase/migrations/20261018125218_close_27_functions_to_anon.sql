do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname = any (array[
        'apply_resend_event_to_email_log','calc_meeting_kpi_goal','can_admin_dept','company_is_approved',
        'get_user_hubs','handle_new_user','internal_can_assign','internal_can_manage_users',
        'internal_user_has_permission','internal_user_role_rank','internal_user_role_slug',
        'investor_has_company_document_access','investor_owns_company','investor_profiles_guard',
        'ir_agent_can_edit','ir_agents_before_write','is_internal_user','is_investor','is_super_admin_user',
        'learning_company_last_activity','learning_leaderboard_stats','learning_module_engagement_counts',
        'log_department_features_change','log_department_members_change','pre_dial_gate',
        'profiles_guard_role_escalation','user_belongs_to_company'
      ])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
    n := n + 1;
  end loop;
  raise notice 'functions updated: %', n;
end
$$;
