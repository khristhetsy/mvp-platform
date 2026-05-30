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

export async function notifyFounderSocialDraftGenerated(input: {
  founderId: string;
  draftId: string;
  draftType: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_social_draft_generated",
    title: "Social draft generated",
    message: `Your ${input.draftType.replace(/_/g, " ")} draft is ready for review. No posts were sent.`,
    entityType: "social_outreach_draft",
    entityId: input.draftId,
  });
}

export async function notifyFounderSocialDraftFlagged(input: {
  founderId: string;
  draftId: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_social_draft_flagged",
    title: "Social draft flagged for compliance",
    message: "Risky phrases were detected. Review and edit before copying or posting externally.",
    entityType: "social_outreach_draft",
    entityId: input.draftId,
  });
}

export async function notifyFounderSocialDraftCopied(input: {
  founderId: string;
  draftId: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_social_draft_copied",
    title: "Social draft copied",
    message: "Draft marked as copied. Post manually on your social platform after final review.",
    entityType: "social_outreach_draft",
    entityId: input.draftId,
  });
}

export async function notifyFounderOutreachTargetSelected(input: {
  founderId: string;
  targetId: string;
  displayName: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_outreach_target_selected",
    title: "Investor selected for outreach",
    message: `${input.displayName} was added to your outreach selections.`,
    entityType: "founder_outreach_targets",
    entityId: input.targetId,
  });
}

export async function notifyFounderOutreachTargetPipelined(input: {
  founderId: string;
  targetId: string;
  displayName: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_outreach_target_pipelined",
    title: "Moved to outreach pipeline",
    message: `${input.displayName} is now in your outreach pipeline.`,
    entityType: "founder_outreach_targets",
    entityId: input.targetId,
  });
}

export async function notifyFounderPipelineIntroRequested(input: {
  founderId: string;
  targetId: string;
  threadId: string;
}) {
  return createNotification({
    recipientUserId: input.founderId,
    actorUserId: input.founderId,
    type: "founder_pipeline_intro_requested",
    title: "Intro requested",
    message: "Your intro request was sent via the platform messaging workflow.",
    entityType: "message_thread",
    entityId: input.threadId,
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
