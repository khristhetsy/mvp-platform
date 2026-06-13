import { requireRole } from "@/lib/supabase/auth";
import { getCampaigns } from "@/lib/marketing/campaigns";
import { getLists } from "@/lib/marketing/contacts";
import { getTemplates } from "@/lib/marketing/templates";
import { CampaignsClient } from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function MarketingCampaignsPage() {
  await requireRole(["admin"]);
  const [campaigns, lists, templates] = await Promise.all([
    getCampaigns(),
    getLists(),
    getTemplates(),
  ]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Campaigns</h1>
      </div>
      <CampaignsClient campaigns={campaigns} lists={lists} templates={templates} />
    </div>
  );
}
