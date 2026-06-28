import type { ReactNode } from "react";
import { InvestorPendingApprovalPanel } from "@/components/InvestorPendingApprovalPanel";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireRole } from "@/lib/supabase/auth";

export async function InvestorFeatureGate({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await requireRole(["investor"]);
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (canInvestorPerformSensitiveActions(investorProfile)) {
    return children;
  }

  return (
    <InvestorPendingApprovalPanel
      approvalStatus={investorProfile?.approval_status ?? "draft"}
      adminFeedback={investorProfile?.admin_feedback}
      kycStatus={investorProfile?.kyc_status ?? "not_started"}
    />
  );
}
