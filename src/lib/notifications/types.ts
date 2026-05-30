export type NotificationType =
  | "investor_expressed_interest"
  | "investor_pledge_submitted"
  | "investor_intro_requested"
  | "investor_follow_up_requested"
  | "founder_onboarding_completed"
  | "remediation_task_created"
  | "remediation_task_completed"
  | "learning_module_completed"
  | "investor_onboarding_submitted"
  | "investor_approved"
  | "investor_rejected"
  | "investor_changes_requested"
  | "company_approved"
  | "company_rejected"
  | "company_changes_requested"
  | "company_published"
  | "trial_ending_soon"
  | "trial_expired"
  | "upgrade_request_submitted"
  | "message_thread_created"
  | "message_received"
  | "meeting_requested"
  | "meeting_accepted"
  | "meeting_declined"
  | "meeting_canceled"
  | "google_account_connected"
  | "google_account_disconnected"
  | "meeting_scheduled_google"
  | "meeting_rescheduled_google"
  | "meeting_canceled_google"
  | "meeting_google_sync_failed";

export type NotificationRecord = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: NotificationType | string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};
