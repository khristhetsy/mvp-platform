import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorStageGuideView } from "@/components/investor/InvestorStageGuide";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { listInvestorWorkspaceDataForAuthenticatedInvestor } from "@/lib/data/investor-interests";
import { computeKycChecklistState, listKycDocuments } from "@/lib/investor/kyc";
import { isInvestorProfileComplete } from "@/lib/investor/profile";
import { loadInvestorStageView } from "@/lib/investor-journey/load";
import {
  buildInvestorGuideView,
  getInvestorStageGuide,
  type InvestorGuideSignals,
} from "@/lib/investor/stage-guides";

export const dynamic = "force-dynamic";

export default async function InvestorStageGuidePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  const guide = getInvestorStageGuide(stage);
  if (!guide) notFound();

  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const workspace = await listInvestorWorkspaceDataForAuthenticatedInvestor(investorId);

  const stageView = investorProfile ? await loadInvestorStageView(investorProfile) : null;
  const currentStage = stageView?.current.key ?? "onboard";

  let kycMissing = 0;
  if (investorProfile && currentStage === "verify") {
    const docs = await listKycDocuments(investorProfile.id);
    kycMissing = computeKycChecklistState(investorProfile.investor_type, docs).missingRequired.length;
  }

  const stageOrder = ["onboard", "verify", "access", "manage"] as const;
  const idx = stageOrder.indexOf(currentStage);
  const signals: InvestorGuideSignals = {
    profileComplete: investorProfile
      ? isInvestorProfileComplete(investorProfile) || investorProfile.approval_status !== "draft"
      : false,
    approved: idx >= 1,
    kycVerified: idx >= 2,
    kycDocsComplete: idx >= 2 || (idx === 1 && kycMissing === 0),
    watchlistCount: workspace.savedDeals.length,
    interestCount: workspace.interests.length,
    introCount: workspace.introRequests.length,
    hasCommitment: idx >= 3,
  };

  const view = buildInvestorGuideView(guide, signals, currentStage);

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle="Investor account">
      <WorkspacePageContainer>
        <InvestorStageGuideView guide={view} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
