import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getCampaigns } from "@/lib/marketing/campaigns";
import { getLists } from "@/lib/marketing/contacts";
import { getTemplates } from "@/lib/marketing/templates";
import { emailConfigured } from "@/lib/marketing/send";
import { CampaignsClient } from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function MarketingCampaignsPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  // Load resiliently: a transient blip loading lists/templates (secondary data)
  // shouldn't take down the whole Campaigns page.
  const [campaigns, lists, templates] = await Promise.all([
    getCampaigns(),
    getLists().catch(() => []),
    getTemplates().catch(() => []),
  ]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("campaigns")}</h1>
      </div>
      <CampaignsClient campaigns={campaigns} lists={lists} templates={templates} resendReady={emailConfigured()} />
    </div>
  );
}
