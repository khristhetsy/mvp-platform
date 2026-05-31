import {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  formatSpvCurrency,
  getSpvParticipationTotals,
} from "@/lib/spv/display";
import { areRequiredParticipationRequirementsComplete } from "@/lib/spv/participation-display";
import type {
  SpvChecklistItemRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";

export const SPV_OPERATIONAL_READINESS_STATUSES = [
  "draft",
  "checklist_incomplete",
  "document_ready",
  "investors_pending",
  "ready_for_legal_docs",
  "closed",
] as const;

export type SpvOperationalReadinessStatus = (typeof SPV_OPERATIONAL_READINESS_STATUSES)[number];

export const SPV_NEXT_ACTIONS = [
  "Complete SPV checklist",
  "Invite investors",
  "Review investor documents",
  "Ready for legal document phase",
  "Closed",
] as const;

export type SpvNextAction = (typeof SPV_NEXT_ACTIONS)[number];

export type SpvReadinessContext = {
  spv: SpvOpportunityRecord;
  checklist: SpvChecklistItemRecord[];
  participations: SpvParticipationRecord[];
  requirements: SpvParticipationRequirementRecord[];
};

export function countRequirementsPendingReview(requirements: SpvParticipationRequirementRecord[]) {
  return requirements.filter((row) => ["uploaded", "under_review"].includes(row.status)).length;
}

export function computeSpvOperationalReadinessStatus(ctx: SpvReadinessContext): SpvOperationalReadinessStatus {
  const { spv, checklist, participations, requirements } = ctx;
  const spvStatus = spv.status ?? "draft";

  if (spvStatus === "closed" || spvStatus === "canceled") {
    return "closed";
  }

  if (spvStatus === "draft" || spvStatus === "under_review") {
    return "draft";
  }

  const checklistPct = spv.checklist_readiness_pct ?? computeChecklistReadinessPct(checklist);
  const checklistComplete =
    checklist.length > 0 && areRequiredChecklistItemsComplete(checklist) && checklistPct >= 100;

  if (!checklistComplete && !spv.document_ready_at) {
    return "checklist_incomplete";
  }

  const active = participations.filter((row) => !["declined", "canceled"].includes(row.status));
  const pendingReview = countRequirementsPendingReview(requirements);
  const investorPending = spv.investor_pending_requirements_count ?? 0;

  if (active.length === 0) {
    return "document_ready";
  }

  if (pendingReview > 0 || investorPending > 0) {
    return "investors_pending";
  }

  const allInvestorsReady = active.every((part) => {
    const partReqs = requirements.filter((r) => r.spv_participation_id === part.id);
    if (partReqs.length === 0) {
      return false;
    }
    return areRequiredParticipationRequirementsComplete(partReqs);
  });

  if (!allInvestorsReady) {
    return "investors_pending";
  }

  return "ready_for_legal_docs";
}

export function getSpvNextAction(
  readiness: SpvOperationalReadinessStatus,
  ctx: SpvReadinessContext,
): SpvNextAction {
  if (readiness === "closed") {
    return "Closed";
  }
  if (readiness === "checklist_incomplete" || readiness === "draft") {
    return "Complete SPV checklist";
  }
  if (readiness === "document_ready") {
    return "Invite investors";
  }
  if (readiness === "investors_pending") {
    const pendingReview = countRequirementsPendingReview(ctx.requirements);
    if (pendingReview > 0) {
      return "Review investor documents";
    }
    return "Invite investors";
  }
  return "Ready for legal document phase";
}

export function formatOperationalReadinessLabel(status: SpvOperationalReadinessStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "checklist_incomplete":
      return "Checklist incomplete";
    case "document_ready":
      return "Document ready";
    case "investors_pending":
      return "Investors pending";
    case "ready_for_legal_docs":
      return "Ready for legal docs";
    case "closed":
      return "Closed";
  }
}

export type AdminSpvDashboardMetrics = {
  totalSpvs: number;
  openSpvs: number;
  documentReadySpvs: number;
  totalIndicativeInterest: number;
  investorsDocumentReady: number;
  pendingInvestorRequirements: number;
};

export function buildAdminSpvDashboardMetrics(
  opportunities: SpvOpportunityRecord[],
  participationsBySpv: Record<string, SpvParticipationRecord[]>,
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>,
): AdminSpvDashboardMetrics {
  let totalIndicativeInterest = 0;
  let investorsDocumentReady = 0;
  let pendingInvestorRequirements = 0;
  let documentReadySpvs = 0;
  let openSpvs = 0;

  for (const spv of opportunities) {
    if (spv.status === "open") {
      openSpvs += 1;
    }

    if (spv.document_ready_at || (spv.checklist_readiness_pct ?? 0) >= 100) {
      documentReadySpvs += 1;
    }

    investorsDocumentReady += spv.investors_document_ready_count ?? 0;
    pendingInvestorRequirements += spv.investor_pending_requirements_count ?? 0;

    const parts = participationsBySpv[spv.id] ?? [];
    totalIndicativeInterest += getSpvParticipationTotals(parts).indicativeTotal;
  }

  return {
    totalSpvs: opportunities.length,
    openSpvs,
    documentReadySpvs,
    totalIndicativeInterest,
    investorsDocumentReady,
    pendingInvestorRequirements,
  };
}

export function buildSpvReadinessContext(
  spv: SpvOpportunityRecord,
  checklist: SpvChecklistItemRecord[],
  participations: SpvParticipationRecord[],
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>,
): SpvReadinessContext {
  const requirements: SpvParticipationRequirementRecord[] = [];
  for (const part of participations) {
    const rows = requirementsByParticipation[part.id] ?? [];
    requirements.push(...rows);
  }

  return { spv, checklist, participations, requirements };
}

export type FounderSpvTimelineStep = {
  key: string;
  label: string;
  complete: boolean;
  current: boolean;
};

export function buildFounderSpvTimeline(
  readiness: SpvOperationalReadinessStatus,
  ctx: SpvReadinessContext,
): FounderSpvTimelineStep[] {
  const checklistPct = ctx.spv.checklist_readiness_pct ?? 0;
  const totals = getSpvParticipationTotals(ctx.participations);
  const investorsReady = ctx.spv.investors_document_ready_count ?? 0;

  const steps: FounderSpvTimelineStep[] = [
    {
      key: "checklist",
      label: "SPV preparation checklist",
      complete: checklistPct >= 100 || readiness !== "draft" && readiness !== "checklist_incomplete",
      current: readiness === "checklist_incomplete" || readiness === "draft",
    },
    {
      key: "open",
      label: "SPV open for investor interest",
      complete: ["open", "closed"].includes(ctx.spv.status) || totals.participantCount > 0,
      current: readiness === "document_ready",
    },
    {
      key: "investors",
      label: "Investor document intake",
      complete: investorsReady > 0 && readiness === "ready_for_legal_docs",
      current: readiness === "investors_pending",
    },
    {
      key: "ready",
      label: "Operational document-ready",
      complete: readiness === "ready_for_legal_docs",
      current: readiness === "ready_for_legal_docs",
    },
  ];

  if (readiness === "closed") {
    return steps.map((step) => ({ ...step, current: false, complete: true }));
  }

  return steps;
}

export type InvestorSpvNextAction = {
  label: string;
  detail: string;
};

export function getInvestorSpvNextAction(
  requirements: SpvParticipationRequirementRecord[],
): InvestorSpvNextAction | null {
  if (requirements.length === 0) {
    return null;
  }

  const needsUpload = requirements.filter((row) =>
    ["pending", "rejected"].includes(row.status),
  );
  const awaitingReview = requirements.filter((row) =>
    ["uploaded", "under_review"].includes(row.status),
  );
  const allDone = requirements.every((row) =>
    ["approved", "waived"].includes(row.status),
  );

  if (needsUpload.length > 0) {
    return {
      label: "Upload missing documents",
      detail: `${needsUpload.length} requirement(s) need a supporting document upload.`,
    };
  }

  if (awaitingReview.length > 0) {
    return {
      label: "Awaiting admin review",
      detail: `${awaitingReview.length} uploaded document(s) are under staff review.`,
    };
  }

  if (allDone) {
    return {
      label: "Approved / ready",
      detail: "Your SPV document requirements are complete for operational tracking.",
    };
  }

  return {
    label: "Review SPV requirements",
    detail: "Check your SPV workspace for requirement status updates.",
  };
}

export function formatDashboardIndicativeTotal(amount: number) {
  return formatSpvCurrency(amount);
}
