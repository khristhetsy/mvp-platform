-- Foreign-key covering indexes.
--
-- Adds a btree index for every foreign-key column (as defined across all prior
-- migrations) that has no index, primary key or unique constraint with that column
-- as its leading column. Without one, deletes/updates on the referenced table
-- (e.g. deleting a profile or company) seq-scan the child table, and joins on
-- the FK cannot use an index.
--
-- Partial indexes whose predicate is not implied by "col = $1" (e.g. "where status =
-- 'open'") and GIN indexes are not treated as covering.
--
-- Lookup columns only: audit/actor columns ending in _by (created_by, updated_by,
-- approved_by, reviewed_by, ...) are deliberately excluded.
--
-- Additive and idempotent (IF NOT EXISTS). No CONCURRENTLY: the Supabase SQL editor
-- runs the script in a transaction. Grouped by table, alphabetical.

-- activity_event_escalations
create index if not exists idx_activity_event_escalations_escalated_to on public.activity_event_escalations (escalated_to);

-- activity_stage_policies
create index if not exists idx_activity_stage_policies_escalate_to_user_id on public.activity_stage_policies (escalate_to_user_id);

-- admin_learning_stage_overrides
create index if not exists idx_admin_learning_stage_overrides_company_id on public.admin_learning_stage_overrides (company_id);

-- admin_lesson_assignments
create index if not exists idx_admin_lesson_assignments_company_id on public.admin_lesson_assignments (company_id);

-- admin_reviews
create index if not exists idx_admin_reviews_founder_id on public.admin_reviews (founder_id);

-- admin_task_activity
create index if not exists idx_admin_task_activity_actor_id on public.admin_task_activity (actor_id);

-- admin_tasks
create index if not exists idx_admin_tasks_source_meeting_session_id on public.admin_tasks (source_meeting_session_id);

-- aeo_publish_log
create index if not exists idx_aeo_publish_log_admin_id on public.aeo_publish_log (admin_id);

-- audit_logs
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);

-- calendar_events
create index if not exists idx_calendar_events_department_id on public.calendar_events (department_id);
create index if not exists idx_calendar_events_meeting_key on public.calendar_events (meeting_key);

-- call_attempts
create index if not exists idx_call_attempts_campaign_id on public.call_attempts (campaign_id);
create index if not exists idx_call_attempts_variant_id on public.call_attempts (variant_id);

-- campaigns
create index if not exists idx_campaigns_company_id on public.campaigns (company_id);

-- ceo_campaign_results
create index if not exists idx_ceo_campaign_results_agent_id on public.ceo_campaign_results (agent_id);

-- ceo_checklist_template_items
create index if not exists idx_ceo_checklist_template_items_department_id on public.ceo_checklist_template_items (department_id);

-- ceo_conferences
create index if not exists idx_ceo_conferences_department_id on public.ceo_conferences (department_id);
create index if not exists idx_ceo_conferences_host_id on public.ceo_conferences (host_id);

-- ceo_kpi_meeting_agent_entries
create index if not exists idx_ceo_kpi_meeting_agent_entries_agent_id on public.ceo_kpi_meeting_agent_entries (agent_id);

-- ceo_kpi_meeting_entries
create index if not exists idx_ceo_kpi_meeting_entries_agent_id on public.ceo_kpi_meeting_entries (agent_id);

-- ceo_meeting_attendees
create index if not exists idx_ceo_meeting_attendees_user_id on public.ceo_meeting_attendees (user_id);

-- ceo_meeting_kpi_snapshots
create index if not exists idx_ceo_meeting_kpi_snapshots_department_id on public.ceo_meeting_kpi_snapshots (department_id);

-- ceo_meeting_readiness_log
create index if not exists idx_ceo_meeting_readiness_log_department_id on public.ceo_meeting_readiness_log (department_id);
create index if not exists idx_ceo_meeting_readiness_log_section_id on public.ceo_meeting_readiness_log (section_id);

-- ceo_meeting_reminder_log
create index if not exists idx_ceo_meeting_reminder_log_section_id on public.ceo_meeting_reminder_log (section_id);

-- ceo_meeting_section_entries
create index if not exists idx_ceo_meeting_section_entries_section_id on public.ceo_meeting_section_entries (section_id);

-- ceo_meeting_sections
create index if not exists idx_ceo_meeting_sections_default_presenter_id on public.ceo_meeting_sections (default_presenter_id);
create index if not exists idx_ceo_meeting_sections_department_id on public.ceo_meeting_sections (department_id);

-- ceo_meeting_task_suggestions
create index if not exists idx_ceo_meeting_task_suggestions_confirmed_task_id on public.ceo_meeting_task_suggestions (confirmed_task_id);
create index if not exists idx_ceo_meeting_task_suggestions_section_id on public.ceo_meeting_task_suggestions (section_id);
create index if not exists idx_ceo_meeting_task_suggestions_suggested_assignee_id on public.ceo_meeting_task_suggestions (suggested_assignee_id);
create index if not exists idx_ceo_meeting_task_suggestions_suggested_department_id on public.ceo_meeting_task_suggestions (suggested_department_id);

-- ceo_plan_milestones
create index if not exists idx_ceo_plan_milestones_owner_id on public.ceo_plan_milestones (owner_id);

-- ceo_plan_objectives
create index if not exists idx_ceo_plan_objectives_department_id on public.ceo_plan_objectives (department_id);

-- collaboration_comments
create index if not exists idx_collaboration_comments_author_user_id on public.collaboration_comments (author_user_id);

-- collaboration_threads
create index if not exists idx_collaboration_threads_company_id on public.collaboration_threads (company_id);
create index if not exists idx_collaboration_threads_investor_profile_id on public.collaboration_threads (investor_profile_id);
create index if not exists idx_collaboration_threads_spv_id on public.collaboration_threads (spv_id);

-- companies
create index if not exists idx_companies_founder_id on public.companies (founder_id);

-- company_invites
create index if not exists idx_company_invites_accepted_by_user_id on public.company_invites (accepted_by_user_id);
create index if not exists idx_company_invites_inviter_id on public.company_invites (inviter_id);

-- company_readiness_scores
create index if not exists idx_company_readiness_scores_weight_set_id on public.company_readiness_scores (weight_set_id);

-- compliance_events
create index if not exists idx_compliance_events_founder_id on public.compliance_events (founder_id);
create index if not exists idx_compliance_events_investor_id on public.compliance_events (investor_id);

-- credit_ledger
create index if not exists idx_credit_ledger_event_id on public.credit_ledger (event_id);

-- credit_redemptions
create index if not exists idx_credit_redemptions_item_id on public.credit_redemptions (item_id);

-- crm_contacts
create index if not exists idx_crm_contacts_supabase_profile_id on public.crm_contacts (supabase_profile_id);

-- dd_audit_log
create index if not exists idx_dd_audit_log_actor_id on public.dd_audit_log (actor_id);

-- dd_claims
create index if not exists idx_dd_claims_finding_id on public.dd_claims (finding_id);

-- dd_consent_envelopes
create index if not exists idx_dd_consent_envelopes_version_id on public.dd_consent_envelopes (version_id);

-- dd_doc_requests
create index if not exists idx_dd_doc_requests_document_id on public.dd_doc_requests (document_id);

-- dd_engagements
create index if not exists idx_dd_engagements_owner_id on public.dd_engagements (owner_id);

-- dd_findings
create index if not exists idx_dd_findings_domain_id on public.dd_findings (domain_id);

-- dd_responses
create index if not exists idx_dd_responses_evidence_doc_id on public.dd_responses (evidence_doc_id);

-- deal_room_activity_events
create index if not exists idx_deal_room_activity_events_actor_user_id on public.deal_room_activity_events (actor_user_id);

-- deal_room_document_requests
create index if not exists idx_deal_room_document_requests_fulfilled_document_id on public.deal_room_document_requests (fulfilled_document_id);
create index if not exists idx_deal_room_document_requests_requested_by_user_id on public.deal_room_document_requests (requested_by_user_id);

-- deal_room_questions
create index if not exists idx_deal_room_questions_asked_by_user_id on public.deal_room_questions (asked_by_user_id);

-- deal_rooms
create index if not exists idx_deal_rooms_campaign_id on public.deal_rooms (campaign_id);
create index if not exists idx_deal_rooms_investor_profile_id on public.deal_rooms (investor_profile_id);
create index if not exists idx_deal_rooms_spv_id on public.deal_rooms (spv_id);

-- department_audit_log
create index if not exists idx_department_audit_log_actor_id on public.department_audit_log (actor_id);

-- department_features
create index if not exists idx_department_features_feature_id on public.department_features (feature_id);

-- department_members
create index if not exists idx_department_members_department_id on public.department_members (department_id);

-- diligence_reports
create index if not exists idx_diligence_reports_company_id on public.diligence_reports (company_id);

-- event_activity
create index if not exists idx_event_activity_actor_id on public.event_activity (actor_id);

-- event_banned_attendees
create index if not exists idx_event_banned_attendees_profile_id on public.event_banned_attendees (profile_id);

-- event_brochures
create index if not exists idx_event_brochures_base_edition_id on public.event_brochures (base_edition_id);

-- event_help_requests
create index if not exists idx_event_help_requests_profile_id on public.event_help_requests (profile_id);

-- event_introductions
create index if not exists idx_event_introductions_founder_reg_id on public.event_introductions (founder_reg_id);
create index if not exists idx_event_introductions_investor_reg_id on public.event_introductions (investor_reg_id);

-- event_leads
create index if not exists idx_event_leads_profile_id on public.event_leads (profile_id);

-- event_moderation_log
create index if not exists idx_event_moderation_log_actor_id on public.event_moderation_log (actor_id);

-- event_moderators
create index if not exists idx_event_moderators_user_id on public.event_moderators (user_id);

-- event_muted_attendees
create index if not exists idx_event_muted_attendees_profile_id on public.event_muted_attendees (profile_id);

-- event_poll_votes
create index if not exists idx_event_poll_votes_profile_id on public.event_poll_votes (profile_id);

-- event_presenter_invites
create index if not exists idx_event_presenter_invites_presenter_id on public.event_presenter_invites (presenter_id);
create index if not exists idx_event_presenter_invites_session_id on public.event_presenter_invites (session_id);

-- event_presenters
create index if not exists idx_event_presenters_application_id on public.event_presenters (application_id);
create index if not exists idx_event_presenters_profile_id on public.event_presenters (profile_id);

-- formd_deal_events
create index if not exists idx_formd_deal_events_firm_id on public.formd_deal_events (firm_id);

-- formd_filings
create index if not exists idx_formd_filings_promoted_contact_id on public.formd_filings (promoted_contact_id);

-- formd_firms
create index if not exists idx_formd_firms_promoted_investor_id on public.formd_firms (promoted_investor_id);

-- formd_principals
create index if not exists idx_formd_principals_firm_id on public.formd_principals (firm_id);

-- founder_investor_contacts
create index if not exists idx_founder_investor_contacts_company_id on public.founder_investor_contacts (company_id);

-- founder_lesson_notes
create index if not exists idx_founder_lesson_notes_company_id on public.founder_lesson_notes (company_id);

-- founder_lesson_video_assets
create index if not exists idx_founder_lesson_video_assets_company_id on public.founder_lesson_video_assets (company_id);

-- founder_manual_outreach_recipients
create index if not exists idx_founder_manual_outreach_recipients_contact_id on public.founder_manual_outreach_recipients (contact_id);

-- founder_outreach_targets
create index if not exists idx_founder_outreach_targets_company_id on public.founder_outreach_targets (company_id);
create index if not exists idx_founder_outreach_targets_contact_id on public.founder_outreach_targets (contact_id);
create index if not exists idx_founder_outreach_targets_platform_investor_id on public.founder_outreach_targets (platform_investor_id);

-- founder_quiz_attempts
create index if not exists idx_founder_quiz_attempts_company_id on public.founder_quiz_attempts (company_id);

-- founder_quiz_reviews
create index if not exists idx_founder_quiz_reviews_company_id on public.founder_quiz_reviews (company_id);

-- founder_worksheet_submissions
create index if not exists idx_founder_worksheet_submissions_company_id on public.founder_worksheet_submissions (company_id);

-- internal_role_permissions
create index if not exists idx_internal_role_permissions_permission_id on public.internal_role_permissions (permission_id);

-- internal_user_permission_overrides
create index if not exists idx_internal_user_permission_overrides_permission_id on public.internal_user_permission_overrides (permission_id);

-- intro_requests
create index if not exists idx_intro_requests_campaign_id on public.intro_requests (campaign_id);

-- investor_activity
create index if not exists idx_investor_activity_campaign_id on public.investor_activity (campaign_id);

-- investor_interests
create index if not exists idx_investor_interests_campaign_id on public.investor_interests (campaign_id);

-- investor_pipeline
create index if not exists idx_investor_pipeline_campaign_id on public.investor_pipeline (campaign_id);
create index if not exists idx_investor_pipeline_owner_admin_id on public.investor_pipeline (owner_admin_id);

-- investor_prior_deals
create index if not exists idx_investor_prior_deals_proof_document_id on public.investor_prior_deals (proof_document_id);

-- ir_activities
create index if not exists idx_ir_activities_assignee_id on public.ir_activities (assignee_id);

-- ir_goals
create index if not exists idx_ir_goals_assignee_id on public.ir_goals (assignee_id);
create index if not exists idx_ir_goals_project_id on public.ir_goals (project_id);

-- ir_matches
create index if not exists idx_ir_matches_assignee_id on public.ir_matches (assignee_id);
create index if not exists idx_ir_matches_meeting_booking_id on public.ir_matches (meeting_booking_id);
create index if not exists idx_ir_matches_milestone_id on public.ir_matches (milestone_id);

-- ir_milestones
create index if not exists idx_ir_milestones_parent_id on public.ir_milestones (parent_id);

-- ir_notes
create index if not exists idx_ir_notes_match_id on public.ir_notes (match_id);

-- ir_projects
create index if not exists idx_ir_projects_founder_contact_id on public.ir_projects (founder_contact_id);
create index if not exists idx_ir_projects_owner_id on public.ir_projects (owner_id);
create index if not exists idx_ir_projects_source_opportunity_id on public.ir_projects (source_opportunity_id);

-- ir_tasks
create index if not exists idx_ir_tasks_assignee_id on public.ir_tasks (assignee_id);

-- learning_certificates
create index if not exists idx_learning_certificates_company_id on public.learning_certificates (company_id);
create index if not exists idx_learning_certificates_founder_id on public.learning_certificates (founder_id);
create index if not exists idx_learning_certificates_program_id on public.learning_certificates (program_id);

-- learning_content_approvals
create index if not exists idx_learning_content_approvals_reviewer_id on public.learning_content_approvals (reviewer_id);

-- learning_course_schedules
create index if not exists idx_learning_course_schedules_company_id on public.learning_course_schedules (company_id);

-- learning_deliverable_submissions
create index if not exists idx_learning_deliverable_submissions_company_id on public.learning_deliverable_submissions (company_id);

-- learning_program_modules
create index if not exists idx_learning_program_modules_module_id on public.learning_program_modules (module_id);

-- learning_progress
create index if not exists idx_learning_progress_module_id on public.learning_progress (module_id);

-- learning_quizzes
create index if not exists idx_learning_quizzes_lesson_id on public.learning_quizzes (lesson_id);
create index if not exists idx_learning_quizzes_module_id on public.learning_quizzes (module_id);
create index if not exists idx_learning_quizzes_program_id on public.learning_quizzes (program_id);

-- learning_reminders
create index if not exists idx_learning_reminders_company_id on public.learning_reminders (company_id);

-- learning_user_badges
create index if not exists idx_learning_user_badges_badge_id on public.learning_user_badges (badge_id);

-- lounge_messages
create index if not exists idx_lounge_messages_event_id on public.lounge_messages (event_id);
create index if not exists idx_lounge_messages_profile_id on public.lounge_messages (profile_id);

-- marketing_campaigns
create index if not exists idx_marketing_campaigns_event_id on public.marketing_campaigns (event_id);
create index if not exists idx_marketing_campaigns_list_id on public.marketing_campaigns (list_id);
create index if not exists idx_marketing_campaigns_template_id on public.marketing_campaigns (template_id);

-- marketing_contacts
create index if not exists idx_marketing_contacts_crm_contact_id on public.marketing_contacts (crm_contact_id);

-- marketing_events
create index if not exists idx_marketing_events_sequence_id on public.marketing_events (sequence_id);
create index if not exists idx_marketing_events_step_id on public.marketing_events (step_id);

-- marketing_list_contacts
create index if not exists idx_marketing_list_contacts_contact_id on public.marketing_list_contacts (contact_id);

-- marketing_sequence_batches
create index if not exists idx_marketing_sequence_batches_approver_id on public.marketing_sequence_batches (approver_id);
create index if not exists idx_marketing_sequence_batches_sequence_id on public.marketing_sequence_batches (sequence_id);
create index if not exists idx_marketing_sequence_batches_step_id on public.marketing_sequence_batches (step_id);

-- marketing_sequence_enrollments
create index if not exists idx_marketing_sequence_enrollments_contact_id on public.marketing_sequence_enrollments (contact_id);

-- marketing_sequence_steps
create index if not exists idx_marketing_sequence_steps_template_id on public.marketing_sequence_steps (template_id);

-- marketing_sequences
create index if not exists idx_marketing_sequences_approver_id on public.marketing_sequences (approver_id);

-- message_threads
create index if not exists idx_message_threads_intro_request_id on public.message_threads (intro_request_id);

-- mkt_notification_prefs
create index if not exists idx_mkt_notification_prefs_type_id on public.mkt_notification_prefs (type_id);

-- mkt_notifications
create index if not exists idx_mkt_notifications_type_id on public.mkt_notifications (type_id);

-- networking_optins
create index if not exists idx_networking_optins_profile_id on public.networking_optins (profile_id);

-- notifications
create index if not exists idx_notifications_actor_user_id on public.notifications (actor_user_id);

-- operational_activity_events
create index if not exists idx_operational_activity_events_actor_user_id on public.operational_activity_events (actor_user_id);
create index if not exists idx_operational_activity_events_related_user_id on public.operational_activity_events (related_user_id);

-- ops_settings
create index if not exists idx_ops_settings_default_manager_id on public.ops_settings (default_manager_id);

-- ops_tasks
create index if not exists idx_ops_tasks_assignee_id on public.ops_tasks (assignee_id);

-- organizations
create index if not exists idx_organizations_parent_org_id on public.organizations (parent_org_id);

-- outreach_touches
create index if not exists idx_outreach_touches_campaign_id on public.outreach_touches (campaign_id);

-- pipeline_investor_notes
create index if not exists idx_pipeline_investor_notes_founder_id on public.pipeline_investor_notes (founder_id);

-- playbook_daily_checks
create index if not exists idx_playbook_daily_checks_surface_id on public.playbook_daily_checks (surface_id);

-- playbook_flag
create index if not exists idx_playbook_flag_module_id on public.playbook_flag (module_id);

-- profile_view_log
create index if not exists idx_profile_view_log_match_id on public.profile_view_log (match_id);
create index if not exists idx_profile_view_log_viewer_user_id on public.profile_view_log (viewer_user_id);

-- prospect_intro_requests
create index if not exists idx_prospect_intro_requests_founder_id on public.prospect_intro_requests (founder_id);

-- publish_events
create index if not exists idx_publish_events_contact_id on public.publish_events (contact_id);

-- regcf_documents
create index if not exists idx_regcf_documents_company_id on public.regcf_documents (company_id);

-- sales_activity_log
create index if not exists idx_sales_activity_log_actor_id on public.sales_activity_log (actor_id);

-- sales_ai_insights
create index if not exists idx_sales_ai_insights_snapshot_id on public.sales_ai_insights (snapshot_id);

-- sales_bulk_assign_audit
create index if not exists idx_sales_bulk_assign_audit_actor_id on public.sales_bulk_assign_audit (actor_id);

-- sales_forecast_snapshots
create index if not exists idx_sales_forecast_snapshots_owner_id on public.sales_forecast_snapshots (owner_id);

-- sales_journal_entries
create index if not exists idx_sales_journal_entries_author_id on public.sales_journal_entries (author_id);
create index if not exists idx_sales_journal_entries_revision_of on public.sales_journal_entries (revision_of);
create index if not exists idx_sales_journal_entries_snapshot_ref on public.sales_journal_entries (snapshot_ref);

-- sales_opportunities
create index if not exists idx_sales_opportunities_company_id on public.sales_opportunities (company_id);
create index if not exists idx_sales_opportunities_contact_profile_id on public.sales_opportunities (contact_profile_id);
create index if not exists idx_sales_opportunities_owner_id on public.sales_opportunities (owner_id);
create index if not exists idx_sales_opportunities_pipeline_id on public.sales_opportunities (pipeline_id);
create index if not exists idx_sales_opportunities_stage_id on public.sales_opportunities (stage_id);

-- sales_settings
create index if not exists idx_sales_settings_default_assignee_id on public.sales_settings (default_assignee_id);

-- sales_stages
create index if not exists idx_sales_stages_sequence_id on public.sales_stages (sequence_id);

-- sales_tasks
create index if not exists idx_sales_tasks_assignee_id on public.sales_tasks (assignee_id);

-- saved_deals
create index if not exists idx_saved_deals_campaign_id on public.saved_deals (campaign_id);

-- scheduled_digest_items
create index if not exists idx_scheduled_digest_items_action_id on public.scheduled_digest_items (action_id);

-- session_callin_queue
create index if not exists idx_session_callin_queue_event_id on public.session_callin_queue (event_id);
create index if not exists idx_session_callin_queue_profile_id on public.session_callin_queue (profile_id);

-- session_chat_messages
create index if not exists idx_session_chat_messages_event_id on public.session_chat_messages (event_id);
create index if not exists idx_session_chat_messages_profile_id on public.session_chat_messages (profile_id);

-- session_guests
create index if not exists idx_session_guests_event_id on public.session_guests (event_id);
create index if not exists idx_session_guests_profile_id on public.session_guests (profile_id);

-- session_question_votes
create index if not exists idx_session_question_votes_profile_id on public.session_question_votes (profile_id);

-- session_questions
create index if not exists idx_session_questions_event_id on public.session_questions (event_id);
create index if not exists idx_session_questions_profile_id on public.session_questions (profile_id);

-- session_segments
create index if not exists idx_session_segments_event_id on public.session_segments (event_id);

-- social_alert_rules
create index if not exists idx_social_alert_rules_campaign_id on public.social_alert_rules (campaign_id);

-- social_clicks
create index if not exists idx_social_clicks_campaign_id on public.social_clicks (campaign_id);

-- social_connect_invites
create index if not exists idx_social_connect_invites_account_id on public.social_connect_invites (account_id);
create index if not exists idx_social_connect_invites_assigned_to on public.social_connect_invites (assigned_to);

-- social_outreach_drafts
create index if not exists idx_social_outreach_drafts_campaign_id on public.social_outreach_drafts (campaign_id);
create index if not exists idx_social_outreach_drafts_company_id on public.social_outreach_drafts (company_id);

-- social_recurrences
create index if not exists idx_social_recurrences_campaign_id on public.social_recurrences (campaign_id);

-- social_variants
create index if not exists idx_social_variants_account_id on public.social_variants (account_id);
create index if not exists idx_social_variants_post_id on public.social_variants (post_id);

-- speaker_application_reviews
create index if not exists idx_speaker_application_reviews_reviewer_id on public.speaker_application_reviews (reviewer_id);

-- speaker_applications
create index if not exists idx_speaker_applications_reviewer_id on public.speaker_applications (reviewer_id);

-- sponsor_leads
create index if not exists idx_sponsor_leads_event_id on public.sponsor_leads (event_id);

-- spv_participation_requirements
create index if not exists idx_spv_participation_requirements_uploaded_document_id on public.spv_participation_requirements (uploaded_document_id);

-- stage_gate_reminders
create index if not exists idx_stage_gate_reminders_founder_id on public.stage_gate_reminders (founder_id);

-- support_messages
create index if not exists idx_support_messages_author_user_id on public.support_messages (author_user_id);

-- thread_meetings
create index if not exists idx_thread_meetings_company_id on public.thread_meetings (company_id);
create index if not exists idx_thread_meetings_founder_id on public.thread_meetings (founder_id);
create index if not exists idx_thread_meetings_investor_id on public.thread_meetings (investor_id);

-- voice_live_calls
create index if not exists idx_voice_live_calls_campaign_id on public.voice_live_calls (campaign_id);
create index if not exists idx_voice_live_calls_variant_id on public.voice_live_calls (variant_id);
