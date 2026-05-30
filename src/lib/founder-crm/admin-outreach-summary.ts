import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FounderOutreachAdminSummary = {
  privateContactCount: number;
  activeCampaignCount: number;
  queuedMessageCount: number;
  draftCampaignCount: number;
  outreachTargetCount: number;
  socialDraftCount: number;
  socialDraftFlaggedCount: number;
  socialDraftCopiedCount: number;
};

export async function getFounderOutreachAdminSummary(): Promise<FounderOutreachAdminSummary> {
  const supabase = createServiceRoleClient();

  const [contacts, campaigns, messages, targets, socialDrafts, socialFlagged, socialCopied] = await Promise.all([
    supabase.from("founder_investor_contacts").select("id", { count: "exact", head: true }),
    supabase.from("outreach_campaigns").select("id, status").in("status", ["draft", "queued", "active"]),
    supabase.from("outreach_messages").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("founder_outreach_targets").select("id", { count: "exact", head: true }),
    supabase.from("social_outreach_drafts").select("id", { count: "exact", head: true }),
    supabase
      .from("social_outreach_drafts")
      .select("id", { count: "exact", head: true })
      .eq("compliance_status", "flagged"),
    supabase.from("social_outreach_drafts").select("id", { count: "exact", head: true }).eq("status", "copied"),
  ]);

  const campaignRows = campaigns.data ?? [];
  const activeCampaignCount = campaignRows.filter((row) =>
    ["queued", "active"].includes(String(row.status)),
  ).length;
  const draftCampaignCount = campaignRows.filter((row) => row.status === "draft").length;

  return {
    privateContactCount: contacts.count ?? 0,
    activeCampaignCount,
    queuedMessageCount: messages.count ?? 0,
    draftCampaignCount,
    outreachTargetCount: targets.count ?? 0,
    socialDraftCount: socialDrafts.count ?? 0,
    socialDraftFlaggedCount: socialFlagged.count ?? 0,
    socialDraftCopiedCount: socialCopied.count ?? 0,
  };
}
