import type { EmailTemplateDefinition, EmailTemplateType } from "@/lib/email/types";
import type { UserRole } from "@/lib/supabase/types";

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    type: "founder_investor_intro_followup",
    label: "Investor intro follow-up",
    description: "Polite follow-up after an intro or platform signal — no commitment language.",
    allowedRoles: ["founder"],
    defaultEntityTypes: ["company", "intro_request"],
  },
  {
    type: "founder_onboarding_reminder",
    label: "Onboarding reminder",
    description: "Reminder to complete onboarding or document steps.",
    allowedRoles: ["founder"],
    defaultEntityTypes: ["company"],
  },
  {
    type: "investor_spv_requirement_reminder",
    label: "SPV requirement reminder",
    description: "Reminder about outstanding SPV participation requirements.",
    allowedRoles: ["investor", "admin", "analyst"],
    defaultEntityTypes: ["spv", "spv_participation"],
  },
  {
    type: "admin_company_review_followup",
    label: "Company review follow-up",
    description: "Internal or founder-facing follow-up on company review status.",
    allowedRoles: ["admin", "analyst"],
    defaultEntityTypes: ["company"],
  },
  {
    type: "admin_investor_approval_followup",
    label: "Investor approval follow-up",
    description: "Follow-up on investor profile review — operational tone only.",
    allowedRoles: ["admin", "analyst"],
    defaultEntityTypes: ["investor", "investor_profile"],
  },
  {
    type: "compliance_followup",
    label: "Compliance follow-up",
    description: "Compliance workflow follow-up — not legal advice.",
    allowedRoles: ["admin", "analyst"],
    defaultEntityTypes: ["company", "compliance_event"],
  },
  {
    type: "meeting_followup",
    label: "Meeting follow-up",
    description: "Neutral meeting recap and next steps.",
    allowedRoles: ["founder", "investor", "admin", "analyst"],
    defaultEntityTypes: ["meeting", "company", "thread"],
  },
  {
    type: "import_failure_notice",
    label: "Import failure notice",
    description: "Notify about a failed data import — staff or founder scoped.",
    allowedRoles: ["admin", "analyst", "founder"],
    defaultEntityTypes: ["import_job"],
  },
];

export function getEmailTemplate(type: EmailTemplateType): EmailTemplateDefinition | undefined {
  return EMAIL_TEMPLATES.find((t) => t.type === type);
}

export function listTemplatesForRole(role: UserRole): EmailTemplateDefinition[] {
  return EMAIL_TEMPLATES.filter((t) => t.allowedRoles.includes(role));
}

export function isTemplateAllowedForRole(type: EmailTemplateType, role: UserRole): boolean {
  const def = getEmailTemplate(type);
  return Boolean(def?.allowedRoles.includes(role));
}
