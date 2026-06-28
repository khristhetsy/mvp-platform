import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorPartnerScorePanel } from "@/components/investor/InvestorPartnerScorePanel";
import { loadPartnerScore } from "@/lib/investor-rating/load";
import { buildPartnerCoaching } from "@/lib/investor-rating/coaching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorPartnerScorePage() {
  const { profile } = await requireInvestorWorkspaceSession();

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
      profileSubtitle="Partner Score"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Your standing"
          title="Partner Score"
          description="How you show up as a partner to founders, based on your activity on iCapOS — and the specific ways to strengthen it."
        />
        <div className="max-w-2xl">
          <InvestorPartnerScorePanel score={score} coaching={coaching} />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
