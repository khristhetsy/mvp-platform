import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getLists } from "@/lib/marketing/contacts";
import { getMarketingSettings } from "@/lib/marketing/settings";
import { emailConfigured } from "@/lib/marketing/send";
import { matchCampaignsEnabled, matchSequenceEnabled } from "@/lib/marketing/match-campaign/flag";
import { getMatchCampaign } from "@/lib/marketing/match-campaign/store";
import { MatchCampaignEditor } from "./MatchCampaignEditor";

export const dynamic = "force-dynamic";

// Admin › Marketing Hub › Campaigns › Match campaign (new or existing).
export default async function MatchCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  if (!matchCampaignsEnabled()) notFound();
  const { id } = await params;
  const [lists, settings, campaign] = await Promise.all([
    getLists().catch(() => []),
    getMarketingSettings().catch(() => null),
    id === "new" ? Promise.resolve(null) : getMatchCampaign(id),
  ]);
  if (id !== "new" && !campaign) notFound();
  return (
    <div style={{ padding: 24 }}>
      <MatchCampaignEditor
        initialCampaign={campaign}
        lists={lists.map((l) => ({ id: l.id, name: l.name, count: l.contact_count ?? null }))}
        defaultSender={{
          name: settings?.default_from_name ?? "iCapOS",
          email: settings?.default_from_email ?? "outreach@icapos.com",
          replyTo: settings?.default_reply_to ?? "",
        }}
        senders={settings?.senders ?? []}
        resendReady={emailConfigured()}
        sequenceEnabled={matchSequenceEnabled()}
      />
    </div>
  );
}
