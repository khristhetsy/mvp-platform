// GET /api/mobile/investor-stage-guide?slug=onboarding|verification|access|manage  (Authorization: Bearer <supabase access token>)
// The investor stage guide for the phone: the same view /investor/stages/[stage] renders (src/app/investor/stages/[stage]/page.tsx),
// as JSON, built from the same loaders and the same signals. Read only.
import { NextResponse } from "next/server";
import { listInvestorWorkspaceDataForAuthenticatedInvestor } from "@/lib/data/investor-interests";
import { loadInvestorStageView } from "@/lib/investor-journey/load";
import { computeKycChecklistState, listKycDocuments } from "@/lib/investor/kyc";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { isInvestorProfileComplete } from "@/lib/investor/profile";
import { buildInvestorGuideView, getInvestorStageGuide, type InvestorGuideSignals } from "@/lib/investor/stage-guides";
import { withBearerInvestor } from "../_bearer-investor";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["onboard", "verify", "access", "manage"] as const;

export async function GET(req: Request) {
  const guide = getInvestorStageGuide(new URL(req.url).searchParams.get("slug") ?? "");
  if (!guide) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const result = await withBearerInvestor(req, async ({ profile }) => {
    const { investorProfile } = await loadInvestorWorkspaceContext(profile);
    const workspace = await listInvestorWorkspaceDataForAuthenticatedInvestor(profile.id);
    const stageView = investorProfile ? await loadInvestorStageView(investorProfile) : null;
    const currentStage = stageView?.current.key ?? "onboard";

    let kycMissing = 0;
    if (investorProfile && currentStage === "verify") {
      const docs = await listKycDocuments(investorProfile.id);
      kycMissing = computeKycChecklistState(investorProfile.investor_type, docs).missingRequired.length;
    }

    const idx = STAGE_ORDER.indexOf(currentStage);
    const signals: InvestorGuideSignals = {
      profileComplete: investorProfile ? isInvestorProfileComplete(investorProfile) || investorProfile.approval_status !== "draft" : false,
      approved: idx >= 1,
      kycVerified: idx >= 2,
      kycDocsComplete: idx >= 2 || (idx === 1 && kycMissing === 0),
      watchlistCount: workspace.savedDeals.length,
      interestCount: workspace.interests.length,
      introCount: workspace.introRequests.length,
      hasCommitment: idx >= 3,
    };

    return buildInvestorGuideView(guide, signals, currentStage);
  });

  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
