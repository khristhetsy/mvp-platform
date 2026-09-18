/** IR Hub deal-flow types — client-safe (no IO). Column names mirror the ir_* tables. */

export const IR_STAGES = ["matched", "intro_sent", "contacted", "meeting_scheduled", "meeting_held", "follow_up", "committed", "passed"] as const;
export type IrStage = (typeof IR_STAGES)[number];
export const IR_STAGE_LABEL: Record<IrStage, string> = {
  matched: "Matched", intro_sent: "Intro sent", contacted: "Contacted", meeting_scheduled: "Meeting scheduled",
  meeting_held: "Meeting held", follow_up: "Follow up", committed: "Committed", passed: "Passed",
};

export const IR_ACTIVITY_TYPES = ["email", "call", "voicemail", "meeting", "document", "term_sheet", "note"] as const;
export type IrActivityType = (typeof IR_ACTIVITY_TYPES)[number];
export const IR_ACTIVITY_LABEL: Record<IrActivityType, string> = {
  email: "Email", call: "Call", voicemail: "Voicemail", meeting: "Meeting", document: "Document", term_sheet: "Term sheet", note: "Note",
};
export const IR_ACTIVITY_ICON: Record<IrActivityType, string> = {
  email: "ti-mail", call: "ti-phone", voicemail: "ti-phone-off", meeting: "ti-calendar-event", document: "ti-file-text", term_sheet: "ti-file-certificate", note: "ti-note",
};

export const IR_PROJECT_STATUSES = ["active", "paused", "completed", "cancelled"] as const;
export type IrProjectStatus = (typeof IR_PROJECT_STATUSES)[number];

/** The intro email every match starts with; the dashboard's "Intros sent" counts activities with this subject. */
export const INTRO_SUBJECT = "Send intro email";
export const INTRO_DUE_DAYS = 7;

export type IrProject = {
  id: string; company_id: string | null; founder_contact_id: string | null; title: string; founder_name: string | null;
  owner_id: string; owner_name: string | null; source_opportunity_id: string | null;
  start_date: string; term_months: number; end_date: string; status: IrProjectStatus;
  founder_report_visible: boolean; is_spv: boolean; starred: boolean; weekly_summary: boolean; monthly_summary: boolean; description: string | null; created_at: string;
};

export type IrMilestone = {
  id: string; project_id: string; parent_id: string | null; kind: "month" | "week"; label: string;
  starts_on: string; ends_on: string; sort_order: number; completed_at: string | null;
};

export type IrBlocker = { label: string; cleared_at: string | null };
export const BLOCKER_PRESETS = ["Data room ready", "One pager approved by founder", "Updated deck uploaded"] as const;

export type IrTask = {
  id: string; project_id: string; milestone_id: string; title: string; status: "new" | "in_progress" | "done";
  assignee_id: string | null; assignee_name?: string | null; starred: boolean; notes: string | null; deadline: string | null; blockers: IrBlocker[]; created_at: string;
};

export type IrMatch = {
  id: string; project_id: string; investor_contact_id: string; task_id: string | null; milestone_id: string | null;
  stage: IrStage; assignee_id: string | null; assignee_name?: string | null; fit_tier: "high" | "medium" | "low" | null;
  data_source: string | null; founder_visible: boolean; starred: boolean; stage_changed_at: string;
  term_sheet_received_at: string | null; meeting_booking_id: string | null; blockers: IrBlocker[]; created_at: string;
  /** From crm_contacts at render time — never stored here. */
  investor_name: string | null; investor_firm: string | null;
};

export type IrActivity = {
  id: string; project_id: string; match_id: string | null; task_id: string | null; type: IrActivityType;
  subject: string; description: string | null; outcome: string | null; next_step: string | null;
  due_at: string | null; done_at: string | null; calendar_event_id: string | null; founder_visible: boolean;
  assignee_id: string | null; created_by: string; created_by_name?: string | null; created_at: string;
};

export type IrNote = {
  id: string; project_id: string; match_id: string | null; body: string; founder_visible: boolean;
  noted_on: string; created_by: string; created_by_name?: string | null; created_at: string;
};

export type StaffOption = { id: string; name: string };
