import type { ReactNode } from "react";
import { InvestorStageGatePanel } from "@/components/investor/InvestorStageGatePanel";
import { InvestorStageLockCard } from "@/components/investor/InvestorStageLockCard";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { buildInvestorStageGates, currentInvestorGate, investorLockCopy } from "@/lib/investor-journey/gate";
import { loadInvestorGates } from "@/lib/investor-journey/load";
import { requireRole } from "@/lib/supabase/auth";

/** Gates a page behind Stage 3 (approved and verified). Same lock card and requirements panel as the founder gate. */
export async function InvestorFeatureGate({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await requireRole(["investor"]);
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (canInvestorPerformSensitiveActions(investorProfile)) {
    return children;
  }

  const gates = investorProfile
    ? await loadInvestorGates(investorProfile)
    : buildInvestorStageGates({ approvalStatus: "draft", kycStatus: "not_started", kycMissingCount: 0, hasCommitment: false });
  const copy = investorLockCopy({ approvalStatus: investorProfile?.approval_status, kycStatus: investorProfile?.kyc_status });

  return (
    <div className="space-y-5">
      <InvestorStageLockCard title={copy.title} description={copy.description} />
      <InvestorStageGatePanel gate={currentInvestorGate(gates)} />
    </div>
  );
}
