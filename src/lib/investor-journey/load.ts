import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorProfileRecord } from "@/lib/investor/types";
import { buildInvestorStageView, type InvestorStageView } from "./stages";

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
