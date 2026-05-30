import type { InvestorApprovalStatus } from "@/lib/investor/types";

export function isInvestorApproved(status: InvestorApprovalStatus | string | null | undefined) {
  return status === "approved";
}

export function canInvestorPerformSensitiveActions(status: InvestorApprovalStatus | string | null | undefined) {
  return isInvestorApproved(status);
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
