import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { getTranslations } from "next-intl/server";
import { InvestorActivityTimelineSection } from "@/components/InvestorActivityTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorActivityPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("deal_flow")}
        title={t("recent_activity")}
        description={t("a_timeline_of_your_marketplace_actions_interes")}
      />

      <InvestorFeatureGate>
        <InvestorActivityTimelineSection />
      </InvestorFeatureGate>
    </AppShell>
  );
}
