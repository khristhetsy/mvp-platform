import { assertCanGenerateDraft } from "@/lib/email/draft-access";
import { logEmailDraftGenerated } from "@/lib/email/audit";
import { getGmailFoundationStatus } from "@/lib/email/preferences";
import {
  appendSafetyFooter,
  mergeSafetyNotes,
  validateDraftContent,
} from "@/lib/email/safety-policy";
import { getEmailTemplate } from "@/lib/email/templates";
import type { EmailDraft, EmailDraftRecipient, EmailDraftRequest, EmailDraftResult } from "@/lib/email/types";
import type { Profile } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function buildSubject(
  templateType: EmailDraftRequest["templateType"],
  ctx: { companyName: string | null },
): string {
  const company = ctx.companyName ?? "your company";
  const subjects: Record<EmailDraftRequest["templateType"], string> = {
    founder_investor_intro_followup: `Following up — ${company}`,
    founder_onboarding_reminder: `Reminder: complete your CapitalOS onboarding`,
    investor_spv_requirement_reminder: `Reminder: outstanding SPV requirements`,
    admin_company_review_followup: `Follow-up: company review — ${company}`,
    admin_investor_approval_followup: `Follow-up: investor profile review`,
    compliance_followup: `Compliance follow-up — ${company}`,
    meeting_followup: `Thank you for your time`,
    import_failure_notice: `Notice: data import requires attention`,
  };
  return subjects[templateType].slice(0, 200);
}

function buildBody(
  templateType: EmailDraftRequest["templateType"],
  ctx: { companyName: string | null; spvLabel: string | null; actionTitle: string | null; contactName: string | null },
  request: EmailDraftRequest,
): string {
  const greeting = ctx.contactName ? `Hello ${ctx.contactName},` : "Hello,";
  const company = ctx.companyName ?? "the company";
  const actionNote = ctx.actionTitle ? `\n\nRelated workflow: ${ctx.actionTitle}` : "";
  const spv = ctx.spvLabel ?? "your SPV participation";

  const bodies: Record<EmailDraftRequest["templateType"], string> = {
    founder_investor_intro_followup: `${greeting}

Thank you for your interest in ${company}. I wanted to follow up on our recent introduction through CapitalOS.

We would welcome the opportunity to share more about our progress when convenient. There is no obligation, and any next steps remain entirely at your discretion.

Best regards`,

    founder_onboarding_reminder: `${greeting}

This is a friendly reminder to complete remaining onboarding steps in CapitalOS for ${company}.

Completing your profile and document uploads helps our team review readiness. CapitalOS does not guarantee funding or approval.

Best regards`,

    investor_spv_requirement_reminder: `${greeting}

This is a reminder that ${spv} has outstanding participation requirements in CapitalOS.

Please sign in to your investor workspace to review and upload any pending items. Submission does not guarantee allocation or approval.

Best regards`,

    admin_company_review_followup: `${greeting}

We are following up regarding the review status for ${company} on CapitalOS.

Please let us know if additional information is needed. This message is operational coordination only, not legal or investment advice.

Best regards,
CapitalOS Operations`,

    admin_investor_approval_followup: `${greeting}

We are following up on your investor profile review in CapitalOS.

If additional information is required, we will note it in your workspace. Approval is not guaranteed.

Best regards,
CapitalOS Operations`,

    compliance_followup: `${greeting}

We are following up on an open compliance item for ${company} in CapitalOS.

Please review the compliance workspace for next steps. This is not legal advice.

Best regards,
CapitalOS Compliance Operations`,

    meeting_followup: `${greeting}

Thank you for taking the time to meet. As discussed, here is a brief recap of next steps we noted in CapitalOS.

Please reply with any corrections. No commitment to invest or participate is implied.

Best regards`,

    import_failure_notice: `${greeting}

A recent data import in CapitalOS did not complete successfully. Please review the import details in your admin workspace and retry when ready.

No data was sent externally by this notice.

Best regards,
CapitalOS Operations`,
  };

  let body = bodies[templateType];
  if (request.context?.note && typeof request.context.note === "string") {
    body += `\n\nAdditional context: ${request.context.note.slice(0, 300)}`;
  }
  return body + actionNote;
}

function resolveRecipients(
  request: EmailDraftRequest,
  role: Profile["role"],
): { recipients: EmailDraftRecipient[]; suggested: EmailDraftRecipient[] } {
  const suggested: EmailDraftRecipient[] = [];
  const recipients: EmailDraftRecipient[] = [];

  if (request.recipient && request.recipient.includes("@")) {
    recipients.push({ email: request.recipient, label: "Specified recipient" });
  } else {
    if (role === "founder") {
      suggested.push({ email: "(investor email — add manually)", label: "Investor contact" });
    }
    if (role === "admin" || role === "analyst") {
      suggested.push({ email: "(founder email — add manually)", label: "Founder contact" });
    }
    if (role === "investor") {
      suggested.push({ email: "(operations — add manually if needed)", label: "CapitalOS operations" });
    }
  }

  return { recipients, suggested };
}

function resolveLinks(
  templateType: EmailDraftRequest["templateType"],
  entityType: string | null,
  entityId: string | null,
): EmailDraft["relatedLinks"] {
  const links: EmailDraft["relatedLinks"] = [];
  if (entityType === "company" && entityId) {
    links.push({ label: "Company workspace", href: `/admin/companies/${entityId}` });
  }
  if (entityType === "spv" || entityType === "spv_opportunity") {
    links.push({ label: "SPV operations", href: "/admin/spvs" });
  }
  if (templateType === "compliance_followup") {
    links.push({ label: "Compliance center", href: "/admin/compliance" });
  }
  if (templateType === "import_failure_notice") {
    links.push({ label: "Imports", href: "/admin/imports" });
  }
  links.push({ label: "Action Center", href: "/admin/actions" });
  return links;
}

export async function buildEmailDraft(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  request: EmailDraftRequest,
): Promise<EmailDraftResult | { error: string }> {
  const template = getEmailTemplate(request.templateType);
  if (!template) return { error: "Unknown template type." };

  const access = await assertCanGenerateDraft(profile, request);
  if (!access.ok) return { error: access.error };

  const entityType = access.entityType;
  const entityId = access.entityId;

  const { recipients, suggested } = resolveRecipients(request, profile.role);
  const subject = buildSubject(request.templateType, access.ctx);
  let body = buildBody(request.templateType, access.ctx, request);
  body = appendSafetyFooter(body);

  const contentWarnings = validateDraftContent(subject, body);
  const safetyNotes = mergeSafetyNotes(contentWarnings);

  const gmail = await getGmailFoundationStatus(supabase, profile.id);

  const draft: EmailDraft = {
    templateType: request.templateType,
    subject,
    body,
    recipients,
    cc: [],
    safetyNotes,
    relatedLinks: resolveLinks(request.templateType, entityType, entityId),
    sourceModule: "email",
    sourceActionId: request.sourceActionId ?? null,
    entityType,
    entityId,
    draftOnly: true,
    gmailSendingEnabled: gmail.gmailSendingEnabled,
  };

  await logEmailDraftGenerated(supabase, profile, {
    templateType: request.templateType,
    entityType: draft.entityType,
    entityId: draft.entityId,
    sourceActionId: draft.sourceActionId,
    recipientCount: recipients.length,
  });

  return {
    draft,
    auditId: null,
    suggestedRecipients: suggested,
  };
}
