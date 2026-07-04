import { createNotification, notifyCompanyFounder } from "@/lib/notifications/notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function actorLabel(actorUserId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", actorUserId).maybeSingle();
  return data?.full_name ?? data?.email ?? "An investor";
}

export async function notifyFounderInvestorInterest(input: {
  companyId: string;
  investorId: string;
  entityId: string;
  companyName?: string | null;
}) {
  const label = await actorLabel(input.investorId);
  const name = input.companyName ?? "your company";

  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.investorId,
    type: "investor_expressed_interest",
    title: "New investor interest",
    message: `${label} expressed interest in ${name}.`,
    entityType: "investor_interest",
    entityId: input.entityId,
  });
}

export async function notifyFounderInvestorPledge(input: {
  companyId: string;
  investorId: string;
  entityId: string;
  pledgeAmount: number;
  pledgeCurrency: string;
  companyName?: string | null;
}) {
  const label = await actorLabel(input.investorId);
  const name = input.companyName ?? "your company";

  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.investorId,
    type: "investor_pledge_submitted",
    title: "Investor pledge submitted",
    message: `${label} submitted a ${input.pledgeCurrency} ${input.pledgeAmount.toLocaleString()} pledge on ${name}.`,
    entityType: "investor_interest",
    entityId: input.entityId,
  });
}

export async function notifyFounderInvestorIntro(input: {
  companyId: string;
  investorId: string;
  entityId: string;
  companyName?: string | null;
}) {
  const label = await actorLabel(input.investorId);
  const name = input.companyName ?? "your company";

  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.investorId,
    type: "investor_intro_requested",
    title: "Intro request received",
    message: `${label} requested an introduction for ${name}.`,
    entityType: "intro_request",
    entityId: input.entityId,
  });
}

export async function notifyFounderInvestorFollowUp(input: {
  companyId: string;
  investorId: string;
  entityId: string;
  companyName?: string | null;
}) {
  const label = await actorLabel(input.investorId);
  const name = input.companyName ?? "your company";

  return notifyCompanyFounder(input.companyId, {
    actorUserId: input.investorId,
    type: "investor_follow_up_requested",
    title: "Investor follow-up requested",
    message: `${label} requested a follow-up on ${name}.`,
    entityType: "investor_crm_activity",
    entityId: input.entityId,
  });
}

export async function notifyInvestorReview(input: {
  profileId: string;
  action: "approve" | "reject" | "changes_requested";
  adminId: string;
  entityId: string;
  feedback?: string | null;
  /** When provided, used verbatim as the in-app message body (e.g. an AI-drafted note). */
  customMessage?: string | null;
}) {
  const type =
    input.action === "approve"
      ? "investor_approved"
      : input.action === "reject"
        ? "investor_rejected"
        : "investor_changes_requested";

  const title =
    input.action === "approve"
      ? "Investor account approved"
      : input.action === "reject"
        ? "Investor account rejected"
        : "Changes requested on investor profile";

  const defaultMessage =
    input.action === "approve"
      ? "Your investor profile was approved. Full workspace access is now enabled."
      : input.action === "reject"
        ? `Your investor submission was rejected.${input.feedback ? ` Feedback: ${input.feedback}` : ""}`
        : `Please update your investor onboarding.${input.feedback ? ` Feedback: ${input.feedback}` : ""}`;

  const message = input.customMessage?.trim() || defaultMessage;

  return createNotification({
    recipientUserId: input.profileId,
    actorUserId: input.adminId,
    type,
    title,
    message,
    entityType: "investor_profile",
    entityId: input.entityId,
  });
}
