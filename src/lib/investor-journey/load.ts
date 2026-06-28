import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorProfileRecord } from "@/lib/investor/types";
import { computeKycChecklistState, listKycDocuments } from "@/lib/investor/kyc";
import { buildInvestorStageView, type InvestorStageView } from "./stages";
import { buildInvestorStageCoach, type InvestorStageCoach } from "./coach";

/** True once the investor has any soft-committed or completed SPV participation. */
export async function investorHasCommitment(investorId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("spv_participations")
    .select("id")
    .eq("investor_id", investorId)
    .in("status", ["soft_committed", "documents_pending", "completed"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Build the 4-stage tracker view for an investor from their real account state. */
export async function loadInvestorStageView(
  profile: InvestorProfileRecord,
): Promise<InvestorStageView> {
  const hasCommitment = await investorHasCommitment(profile.profile_id);
  return buildInvestorStageView({
    approvalStatus: profile.approval_status,
    kycStatus: profile.kyc_status,
    hasCommitment,
  });
}

/** Stage tracker + the one contextual next step for the dashboard. */
export async function loadInvestorJourney(
  profile: InvestorProfileRecord,
  opts: { hasEngaged: boolean },
): Promise<{ stageView: InvestorStageView; coach: InvestorStageCoach }> {
  const stageView = await loadInvestorStageView(profile);

  // The exact "N docs left" copy only matters while the investor is in Verify.
  let kycMissingCount = 0;
  if (stageView.current.key === "verify") {
    const docs = await listKycDocuments(profile.id);
    kycMissingCount = computeKycChecklistState(profile.investor_type, docs).missingRequired.length;
  }

  const coach = buildInvestorStageCoach({
    stage: stageView.current.key,
    approvalStatus: profile.approval_status,
    kycStatus: profile.kyc_status,
    kycMissingCount,
    hasEngaged: opts.hasEngaged,
  });

  return { stageView, coach };
}
