import type { UserRole } from "@/lib/supabase/types";

export const EMAIL_TEMPLATE_TYPES = [
  "founder_investor_intro_followup",
  "founder_onboarding_reminder",
  "investor_spv_requirement_reminder",
  "admin_company_review_followup",
  "admin_investor_approval_followup",
  "compliance_followup",
  "meeting_followup",
  "import_failure_notice",
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

export type EmailDraftRecipient = {
  email: string;
  label: string;
};

export type EmailDraft = {
  templateType: EmailTemplateType;
  subject: string;
  body: string;
  recipients: EmailDraftRecipient[];
  cc: EmailDraftRecipient[];
  safetyNotes: string[];
  relatedLinks: Array<{ label: string; href: string }>;
  sourceModule: string;
  sourceActionId: string | null;
  entityType: string | null;
  entityId: string | null;
  draftOnly: true;
  gmailSendingEnabled: false;
};

export type EmailDraftRequest = {
  templateType: EmailTemplateType;
  entityType?: string | null;
  entityId?: string | null;
  recipient?: string | null;
  context?: Record<string, unknown>;
  sourceActionId?: string | null;
};

export type EmailDraftResult = {
  draft: EmailDraft;
  auditId: string | null;
  suggestedRecipients: EmailDraftRecipient[];
};

export type EmailTemplateDefinition = {
  type: EmailTemplateType;
  label: string;
  description: string;
  allowedRoles: UserRole[];
  defaultEntityTypes: string[];
};

export type GmailFoundationStatus = {
  draftingAvailable: true;
  gmailSendingEnabled: false;
  googleConnected: boolean;
  googleEmailHint: string | null;
  message: string;
};
