import type { InvestorApprovalStatus, InvestorKycStatus } from "@/lib/investor/types";

export function isInvestorApproved(status: InvestorApprovalStatus | string | null | undefined) {
  return status === "approved";
}

/** Minimal shape needed to decide full-access: profile approved AND KYC verified. */
type InvestorAccessFields = {
  approval_status?: InvestorApprovalStatus | string | null;
  kyc_status?: InvestorKycStatus | string | null;
};

/**
 * Full deal-flow access (Stage 3) requires the profile to be approved (Stage 1)
 * AND KYC/accreditation verified (Stage 2).
 */
export function canInvestorPerformSensitiveActions(
  profile: InvestorAccessFields | null | undefined,
) {
  return profile?.approval_status === "approved" && profile?.kyc_status === "verified";
}

export function investorApprovalStatusLabel(status: InvestorApprovalStatus | string | null | undefined) {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "Changes requested";
    default:
      return "Unknown";
  }
}

export function isInvestorOnboardingPath(pathname: string) {
  return pathname === "/investor/onboarding" || pathname.startsWith("/investor/onboarding/");
}

export function isInvestorLimitedPath(pathname: string) {
  return (
    pathname === "/investor" ||
    pathname === "/investor/dashboard" ||
    pathname.startsWith("/investor/dashboard/") ||
    isInvestorOnboardingPath(pathname)
  );
}
