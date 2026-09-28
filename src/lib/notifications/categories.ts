/**
 * What kind of notification this is, in the same color language as the
 * emails (src/lib/email/layout.ts): navy for team work, blue for a founder's
 * raise, green for investors and deals, amber for billing and account
 * problems, grey for everything else. Also decides whether it needs the
 * reader to do something, which drives the bell's "Needs action" filter.
 * Pure, so it is shared by the bell and the notifications page.
 */

export type NotificationCategory = {
  /** Short label shown above the title. */
  label: string;
  /** Text color for the label and the unread dot. Passes 4.5:1 on white. */
  color: string;
  needsAction: boolean;
};

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const GREEN = "#0E7C66";
const AMBER = "#B45309";
const GREY = "#5A6B8C";

/** Types that ask the reader to do something, whatever their severity. */
const ACTION_TYPES = new Set<string>([
  "journey_digest",
  "sms_reply",
  "investor_intro_requested",
  "investor_follow_up_requested",
  "founder_pipeline_intro_requested",
  "founder_follow_up_due",
  "founder_outreach_blocked",
  "founder_social_draft_flagged",
  "meeting_requested",
  "meeting_google_sync_failed",
  "google_account_disconnected",
  "deal_room_question_created",
  "deal_room_document_requested",
  "company_changes_requested",
  "investor_changes_requested",
  "investor_onboarding_submitted",
  "upgrade_request_submitted",
  "trial_ending_soon",
  "trial_expired",
  "spv_requirements_requested",
  "spv_requirement_uploaded",
  "spv_investor_documents_pending_review",
  "spv_ready_for_final_review",
  "next_best_action_escalated",
  "next_best_action_critical_escalated",
  "compliance_event_created",
  "preparation_nudge",
  "journey_nudge",
]);

const URGENT_SEVERITIES = new Set(["critical", "high", "warning", "error"]);

type Rule = { test: (t: string) => boolean; label: string; color: string };

// First match wins; order goes from specific to general.
const RULES: Rule[] = [
  { test: (t) => t === "journey_digest" || t.includes("stage") || t.includes("approval") || t.includes("_nudge"), label: "Journey", color: NAVY },
  { test: (t) => t === "sms_reply" || t.startsWith("founder_outreach") || t.startsWith("outreach"), label: "Outreach", color: NAVY },
  { test: (t) => t.startsWith("deal_room"), label: "Deal room", color: BLUE },
  { test: (t) => t.startsWith("spv_"), label: "SPV", color: GREEN },
  { test: (t) => t.includes("match") || t.startsWith("intro_") || t.includes("_intro_") || t.includes("investor_expressed") || t.includes("interest"), label: "Match", color: GREEN },
  { test: (t) => t.startsWith("investor_"), label: "Investor", color: GREEN },
  { test: (t) => t.includes("meeting"), label: "Meeting", color: BLUE },
  { test: (t) => t.includes("message"), label: "Messages", color: BLUE },
  { test: (t) => t.includes("trial") || t.includes("billing") || t.includes("upgrade"), label: "Billing", color: AMBER },
  { test: (t) => t.startsWith("google_"), label: "Google", color: AMBER },
  { test: (t) => t.includes("compliance"), label: "Compliance", color: AMBER },
  { test: (t) => t.startsWith("company_") || t.startsWith("founder_"), label: "Company", color: NAVY },
  { test: (t) => t.includes("learning") || t.startsWith("remediation"), label: "Learning", color: BLUE },
  { test: (t) => t.includes("digest") || t.includes("reminder") || t.startsWith("next_best_action"), label: "Reminder", color: GREY },
  { test: (t) => t.startsWith("social"), label: "Social", color: GREY },
];

export function notificationCategory(type: string, severity?: string | null): NotificationCategory {
  const t = (type ?? "").toLowerCase();
  const rule = RULES.find((r) => r.test(t));
  const urgent = URGENT_SEVERITIES.has((severity ?? "").toLowerCase());
  return {
    label: rule?.label ?? "Update",
    color: urgent && !rule ? AMBER : rule?.color ?? GREY,
    needsAction: ACTION_TYPES.has(t) || urgent,
  };
}
