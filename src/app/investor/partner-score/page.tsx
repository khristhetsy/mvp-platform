import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTranslations } from "next-intl/server";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorPartnerScorePanel } from "@/components/investor/InvestorPartnerScorePanel";
import { loadPartnerScore } from "@/lib/investor-rating/load";
import { buildPartnerCoaching } from "@/lib/investor-rating/coaching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorPartnerScorePage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");

  // Service role: an investor computing their own score needs to read across
  // interests, deal rooms, threads and profile — all keyed to their own id.
  const supabase = createServiceRoleClient();
  const score = await loadPartnerScore(supabase, profile.id);
  const coaching = await buildPartnerCoaching(score);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("partner_score")}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("your_standing")}
          title={t("partner_score")}
          description={t("how_you_show_up_as_a_partner_to_founders_based")}
        />
        <div className="max-w-2xl">
          <InvestorPartnerScorePanel score={score} coaching={coaching} />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
