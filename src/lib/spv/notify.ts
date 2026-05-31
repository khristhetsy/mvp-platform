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
