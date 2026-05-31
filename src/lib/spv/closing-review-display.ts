import type { SpvClosingReviewStatus } from "@/lib/spv/types";

export type ClosingReadinessCriterionKey =
  | "operational_readiness"
  | "checklist_complete"
  | "investor_requirements_complete"
  | "packages_complete"
  | "target_met"
  | "no_critical_compliance";

export type ClosingReadinessCriterion = {
  key: ClosingReadinessCriterionKey;
  label: string;
  met: boolean;
};

export type ClosingReadinessSummary = {
  criteria: ClosingReadinessCriterion[];
  readinessPct: number;
  eligibleForFinalReview: boolean;
};

export function computeClosingReadinessPct(criteria: ClosingReadinessCriterion[]) {
  if (criteria.length === 0) {
    return 0;
  }
  const met = criteria.filter((row) => row.met).length;
  return Math.round((met / criteria.length) * 100);
}

export function buildClosingReadinessSummary(
  criteria: ClosingReadinessCriterion[],
): ClosingReadinessSummary {
  const readinessPct = computeClosingReadinessPct(criteria);
  return {
    criteria,
    readinessPct,
    eligibleForFinalReview: criteria.every((row) => row.met),
  };
}

export function formatClosingReviewStatusLabel(status: SpvClosingReviewStatus | string) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_review":
      return "In review";
    case "approved_for_closing":
      return "Approved for closing";
    case "changes_required":
      return "Changes required";
    case "closed_operationally":
      return "Operationally closed";
    case "canceled":
      return "Canceled";
    default:
      return status.replace(/_/g, " ");
  }
}

export function formatFounderClosingStageLabel(
  reviewStatus: SpvClosingReviewStatus | string | null | undefined,
  investorClosingStatus: string | null | undefined,
) {
  if (reviewStatus) {
    if (reviewStatus === "closed_operationally") {
      return "Operationally closed";
    }
    if (reviewStatus === "approved_for_closing") {
      return "Approved for operational closing";
    }
    if (reviewStatus === "in_review" || reviewStatus === "changes_required") {
      return "Final operational review";
    }
  }

  return formatFounderClosingStageFromPublicStatus(investorClosingStatus);
}

/** Founder-safe label derived from public aggregate status only (no internal review row). */
export function formatFounderClosingStageFromPublicStatus(
  investorClosingStatus: string | null | undefined,
) {
  switch (investorClosingStatus) {
    case "Operationally closed":
      return "Operationally closed";
    case "Ready for closing":
      return "Approved for operational closing";
    case "Final review":
      return "Final operational review";
    case "Documents being prepared":
    case "Documents under review":
    case "Documents ready":
      return "Document package phase in progress";
    default:
      return "Pre-closing preparation";
  }
}

export function computeInvestorClosingPublicStatus(input: {
  reviewStatus: SpvClosingReviewStatus | string | null | undefined;
  spvStatus: string | null | undefined;
  cachedStatus: string | null | undefined;
  eligibleForFinalReview?: boolean;
}): string {
  if (
    input.reviewStatus === "closed_operationally" ||
    input.spvStatus === "closed"
  ) {
    return "Operationally closed";
  }
  if (input.reviewStatus === "approved_for_closing") {
    return "Ready for closing";
  }
  if (
    input.reviewStatus === "in_review" ||
    input.reviewStatus === "changes_required" ||
    (input.reviewStatus === "not_started" && input.eligibleForFinalReview)
  ) {
    return "Final review";
  }
  return input.cachedStatus ?? "Preparing";
}
