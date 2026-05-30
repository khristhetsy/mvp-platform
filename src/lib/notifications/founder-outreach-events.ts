import { createNotification } from "@/lib/notifications/notifications";

export async function notifyFounderImportCompleted(input: {
  founderId: string;
  imported: number;
  skipped: number;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_contacts_imported",
    title: "Investor contacts imported",
    message: `${input.imported} contacts saved${input.skipped > 0 ? `, ${input.skipped} skipped as duplicates` : ""}.`,
    entityType: "founder_investor_contacts",
    entityId: input.founderId,
  });
}

export async function notifyFounderCampaignDrafted(input: {
  founderId: string;
  campaignId: string;
  campaignName: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_outreach_campaign_drafted",
    title: "Outreach campaign drafted",
    message: `Campaign "${input.campaignName}" is ready for review. No emails have been sent.`,
    entityType: "outreach_campaign",
    entityId: input.campaignId,
  });
}

export async function notifyFounderOutreachBlocked(input: {
  founderId: string;
  reason: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_outreach_blocked",
    title: "Outreach blocked",
    message: input.reason,
    entityType: "outreach_campaign",
    entityId: input.founderId,
  });
}

export async function notifyFounderFollowUpDue(input: {
  founderId: string;
  count: number;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_follow_up_due",
    title: "Follow-ups due",
    message: `${input.count} outreach ${input.count === 1 ? "target needs" : "targets need"} follow-up.`,
    entityType: "founder_outreach_targets",
    entityId: input.founderId,
  });
}
