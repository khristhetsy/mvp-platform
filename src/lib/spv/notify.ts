import { createNotification, notifyCompanyFounder, notifyStaff } from "@/lib/notifications/notifications";

export async function notifyFounderSpvOpened(input: {
  companyId: string;
  spvName: string;
  actorId: string;
}) {
  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.actorId,
    type: "spv_opportunity_opened",
    title: "SPV opportunity opened",
    message: `Admin opened SPV opportunity "${input.spvName}" for your company.`,
    entityType: "spv_opportunity",
    entityId: input.companyId,
  });
}

export async function notifyInvestorSpvInvited(input: {
  investorId: string;
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  actorId: string;
}) {
  return createNotification({
    recipientUserId: input.investorId,
    actorUserId: input.actorId,
    type: "spv_investor_invited",
    title: "SPV opportunity invitation",
    message: `You are invited to review SPV opportunity "${input.spvName}" for ${input.companyName}. Indications are non-binding.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvInterest(input: {
  investorId: string;
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  indicativeAmount?: number | null;
}) {
  const amount =
    input.indicativeAmount != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          input.indicativeAmount,
        )
      : "not specified";

  return notifyStaff({
    actorUserId: input.investorId,
    type: "spv_interest_expressed",
    title: "SPV interest expressed",
    message: `Investor expressed SPV interest for "${input.spvName}" (${input.companyName}) — indicative ${amount}.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvChecklistComplete(input: {
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  actorId: string | null;
}) {
  return notifyStaff({
    actorUserId: input.actorId,
    type: "spv_checklist_complete",
    title: "SPV checklist complete",
    message: `Document readiness checklist reached 100% for SPV "${input.spvName}" (${input.companyName}).`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyFounderSpvDocumentReady(input: {
  companyId: string;
  spvOpportunityId: string;
  spvName: string;
  actorId: string | null;
}) {
  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.actorId,
    type: "spv_document_ready",
    title: "SPV document-ready (operational)",
    message: `SPV "${input.spvName}" reached document readiness on the internal checklist. This is operational tracking only — not legal offering documents.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyInvestorSpvRequirementsRequested(input: {
  investorId: string;
  spvOpportunityId: string;
  spvName: string;
  actorId?: string | null;
}) {
  return createNotification({
    recipientUserId: input.investorId,
    actorUserId: input.actorId,
    type: "spv_requirements_requested",
    title: "SPV document requirements",
    message: `Document intake requirements were added for SPV "${input.spvName}". Upload is coming soon — track status in your SPV workspace.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyInvestorSpvRequirementReviewed(input: {
  investorId: string;
  spvOpportunityId: string;
  spvName: string;
  requirementTitle: string;
  status: string;
  reviewNotes?: string | null;
  actorId: string;
}) {
  const rejectionNote =
    input.status === "rejected" && input.reviewNotes?.trim()
      ? ` Reason: ${input.reviewNotes.trim()}`
      : "";

  return createNotification({
    recipientUserId: input.investorId,
    actorUserId: input.actorId,
    type: "spv_requirement_reviewed",
    title: "SPV document requirement updated",
    message: `"${input.requirementTitle}" for ${input.spvName} is now ${input.status}.${rejectionNote} Operational tracking only — not acceptance into an offering.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvRequirementUploaded(input: {
  investorId: string;
  spvOpportunityId: string;
  spvName: string;
  requirementTitle: string;
  actorId: string;
}) {
  return notifyStaff({
    actorUserId: input.actorId,
    type: "spv_requirement_uploaded",
    title: "SPV requirement uploaded",
    message: `Investor uploaded "${input.requirementTitle}" for ${input.spvName}. Review in admin SPV workspace.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvReadyForLegalDocs(input: {
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  actorId: string | null;
}) {
  return notifyStaff({
    actorUserId: input.actorId,
    type: "spv_ready_for_legal_docs",
    title: "SPV ready for legal document phase",
    message: `SPV "${input.spvName}" (${input.companyName}) reached operational readiness for the legal document phase. No documents are generated automatically.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvInvestorDocumentsPendingReview(input: {
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  pendingReviewCount: number;
  actorId: string | null;
}) {
  return notifyStaff({
    actorUserId: input.actorId,
    type: "spv_investor_documents_pending_review",
    title: "SPV investor documents pending review",
    message: `${input.pendingReviewCount} investor document(s) for "${input.spvName}" (${input.companyName}) await staff review.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyStaffSpvTargetAmountReached(input: {
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  indicativeTotal: number;
  targetAmount: number;
  actorId: string | null;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(input.indicativeTotal);
  const target = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(input.targetAmount);

  return notifyStaff({
    actorUserId: input.actorId,
    type: "spv_target_amount_reached",
    title: "SPV indicative target reached",
    message: `SPV "${input.spvName}" (${input.companyName}) reached or exceeded its indicative target (${formatted} vs ${target} target). Non-binding interest only.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyFounderSpvInvestorAggregateChanged(input: {
  companyId: string;
  spvOpportunityId: string;
  spvName: string;
  companyName: string;
  investorsReady: number;
  pendingRequirements: number;
  actorId: string | null;
}) {
  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.actorId,
    type: "spv_investor_aggregate_changed",
    title: "SPV investor document readiness updated",
    message: `${input.spvName}: ${input.investorsReady} investor(s) document-ready, ${input.pendingRequirements} pending requirement(s). Aggregate tracking only — no investor documents are shared with founders.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}

export async function notifyInvestorSpvStatusChanged(input: {
  recipientUserId: string;
  spvOpportunityId: string;
  spvName: string;
  status: string;
  actorId: string;
  title?: string;
  message?: string;
}) {
  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorId,
    type: "spv_participation_status_changed",
    title: input.title ?? "SPV participation updated",
    message: input.message ?? `Your participation in "${input.spvName}" is now ${input.status}.`,
    entityType: "spv_opportunity",
    entityId: input.spvOpportunityId,
  });
}
