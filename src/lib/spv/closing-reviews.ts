import {
  buildClosingReadinessSummary,
  computeInvestorClosingPublicStatus,
  formatFounderClosingStageLabel,
  type ClosingReadinessCriterion,
  type ClosingReadinessSummary,
} from "@/lib/spv/closing-review-display";
import {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  getSpvParticipationTotals,
} from "@/lib/spv/display";
import {
  notifyFounderSpvApprovedForClosing,
  notifyInvestorSpvOperationallyClosed,
  notifyStaffSpvReadyForFinalReview,
} from "@/lib/spv/notify";
import { areRequiredParticipationRequirementsComplete } from "@/lib/spv/participation-display";
import {
  buildSpvReadinessContext,
  computeSpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvClosingReviewStatus,
  SpvDocumentPackageRecord,
  SpvDocumentPackageStatus,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const COMPLETE_PACKAGE_STATUSES: SpvDocumentPackageStatus[] = ["approved", "issued", "archived"];

export {
  buildClosingReadinessSummary,
  computeClosingReadinessPct,
  computeInvestorClosingPublicStatus,
  formatClosingReviewStatusLabel,
  formatFounderClosingStageLabel,
} from "@/lib/spv/closing-review-display";

export type ClosingReadinessInput = {
  spv: SpvOpportunityRecord;
  checklist: SpvChecklistItemRecord[];
  participations: SpvParticipationRecord[];
  requirements: SpvParticipationRequirementRecord[];
  packages: SpvDocumentPackageRecord[];
  criticalComplianceOpenCount: number;
};

export function computeClosingReadinessCriteria(
  input: ClosingReadinessInput,
): ClosingReadinessCriterion[] {
  const ctx = buildSpvReadinessContext(
    input.spv,
    input.checklist,
    input.participations,
    groupRequirements(input.requirements),
  );
  const operational = computeSpvOperationalReadinessStatus(ctx);
  const operationalOk = operational === "ready_for_legal_docs" || operational === "closed";

  const checklistPct = input.spv.checklist_readiness_pct ?? computeChecklistReadinessPct(input.checklist);
  const checklistComplete =
    input.checklist.length > 0 &&
    areRequiredChecklistItemsComplete(input.checklist) &&
    checklistPct >= 100;

  const active = input.participations.filter((row) => !["declined", "canceled"].includes(row.status));
  const investorRequirementsComplete =
    active.length === 0 ||
    active.every((part) => {
      const partReqs = input.requirements.filter((r) => r.spv_participation_id === part.id);
      return partReqs.length > 0 && areRequiredParticipationRequirementsComplete(partReqs);
    });

  const packagesComplete =
    input.packages.length > 0 &&
    input.packages.every((row) =>
      COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus),
    );

  const target = input.spv.target_amount != null ? Number(input.spv.target_amount) : null;
  const totals = getSpvParticipationTotals(active);
  const targetMet =
    Boolean(input.spv.closing_target_override) ||
    (target != null && target > 0 && totals.indicativeTotal >= target);

  const noCriticalCompliance = input.criticalComplianceOpenCount === 0;

  return [
    {
      key: "operational_readiness",
      label: "SPV operational readiness (legal-docs phase or closed)",
      met: operationalOk,
    },
    {
      key: "checklist_complete",
      label: "SPV document checklist complete",
      met: checklistComplete,
    },
    {
      key: "investor_requirements_complete",
      label: "Investor requirements approved or waived",
      met: investorRequirementsComplete,
    },
    {
      key: "packages_complete",
      label: "Document packages approved or issued",
      met: packagesComplete,
    },
    {
      key: "target_met",
      label: "Indicative target reached or admin override",
      met: targetMet,
    },
    {
      key: "no_critical_compliance",
      label: "No open critical compliance events for company",
      met: noCriticalCompliance,
    },
  ];
}

function groupRequirements(requirements: SpvParticipationRequirementRecord[]) {
  const map: Record<string, SpvParticipationRequirementRecord[]> = {};
  for (const row of requirements) {
    const list = map[row.spv_participation_id] ?? [];
    list.push(row);
    map[row.spv_participation_id] = list;
  }
  return map;
}

export async function countCriticalOpenComplianceForCompany(
  admin: SupabaseClient<Database>,
  companyId: string,
) {
  const { count, error } = await admin
    .from("compliance_events")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("severity", "critical")
    .in("status", ["open", "under_review"]);

  if (error) {
    return { error, count: 0 };
  }

  return { count: count ?? 0 };
}

export async function getSpvClosingReview(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const { data, error } = await admin
    .from("spv_closing_reviews")
    .select("*")
    .eq("spv_opportunity_id", spvOpportunityId)
    .maybeSingle();

  if (error) {
    return { error };
  }

  return { data: (data ?? null) as SpvClosingReviewRecord | null };
}

export async function listAdminClosingReviewsBySpv(
  admin: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, SpvClosingReviewRecord> };
  }

  const { data, error } = await admin
    .from("spv_closing_reviews")
    .select("*")
    .in("spv_opportunity_id", spvOpportunityIds);

  if (error) {
    return { error };
  }

  const map: Record<string, SpvClosingReviewRecord> = {};
  for (const row of (data ?? []) as SpvClosingReviewRecord[]) {
    map[row.spv_opportunity_id] = row;
  }

  return { data: map };
}

export async function listFounderClosingSummaries(
  supabase: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, { stageLabel: string; readinessPct: number }> };
  }

  const { data, error } = await supabase
    .from("spv_closing_reviews")
    .select("spv_opportunity_id, status")
    .in("spv_opportunity_id", spvOpportunityIds);

  if (error) {
    return { error };
  }

  const { data: spvs, error: spvError } = await supabase
    .from("spv_opportunities")
    .select("id, closing_readiness_pct, investor_closing_status")
    .in("id", spvOpportunityIds);

  if (spvError) {
    return { error: spvError };
  }

  const reviewBySpv = new Map(
    ((data ?? []) as { spv_opportunity_id: string; status: string }[]).map((row) => [
      row.spv_opportunity_id,
      row.status,
    ]),
  );

  const summaries: Record<string, { stageLabel: string; readinessPct: number }> = {};
  for (const spv of spvs ?? []) {
    const reviewStatus = reviewBySpv.get(spv.id);
    summaries[spv.id] = {
      stageLabel: formatFounderClosingStageLabel(reviewStatus, spv.investor_closing_status),
      readinessPct: spv.closing_readiness_pct ?? 0,
    };
  }

  return { data: summaries };
}

export async function ensureSpvClosingReview(
  admin: SupabaseClient<Database>,
  input: {
    spvOpportunityId: string;
    companyId: string;
    snapshot: Record<string, unknown>;
  },
) {
  const existing = await getSpvClosingReview(admin, input.spvOpportunityId);
  if (existing.error) {
    return { error: existing.error };
  }
  if (existing.data) {
    const { error } = await admin
      .from("spv_closing_reviews")
      .update({
        readiness_snapshot: input.snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
    if (error) {
      return { error };
    }
    return { data: existing.data, created: false as const };
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("spv_closing_reviews")
    .insert({
      spv_opportunity_id: input.spvOpportunityId,
      company_id: input.companyId,
      status: "not_started",
      readiness_snapshot: input.snapshot,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to create closing review.") };
  }

  return { data: data as SpvClosingReviewRecord, created: true as const };
}

export async function syncSpvClosingReadiness(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  input: {
    actorId: string | null;
    checklist?: SpvChecklistItemRecord[];
    participations?: SpvParticipationRecord[];
    requirements?: SpvParticipationRequirementRecord[];
    packages?: SpvDocumentPackageRecord[];
    criticalComplianceOpenCount?: number;
  },
) {
  const { data: spv, error: spvError } = await admin
    .from("spv_opportunities")
    .select("*, companies(company_name)")
    .eq("id", spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV not found.") };
  }

  const record = spv as SpvOpportunityRecord;

  let checklist = input.checklist;
  if (!checklist) {
    const { data } = await admin
      .from("spv_checklist_items")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    checklist = (data ?? []) as SpvChecklistItemRecord[];
  }

  let participations = input.participations;
  if (!participations) {
    const { data } = await admin
      .from("spv_participations")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    participations = (data ?? []) as SpvParticipationRecord[];
  }

  let requirements = input.requirements;
  if (!requirements) {
    const { data } = await admin
      .from("spv_participation_requirements")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    requirements = (data ?? []) as SpvParticipationRequirementRecord[];
  }

  let packages = input.packages;
  if (!packages) {
    const { data } = await admin
      .from("spv_document_packages")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    packages = (data ?? []) as SpvDocumentPackageRecord[];
  }

  let criticalCount = input.criticalComplianceOpenCount;
  if (criticalCount === undefined) {
    const counted = await countCriticalOpenComplianceForCompany(admin, record.company_id);
    if (counted.error) {
      return { error: counted.error };
    }
    criticalCount = counted.count;
  }

  const criteria = computeClosingReadinessCriteria({
    spv: record,
    checklist,
    participations,
    requirements,
    packages,
    criticalComplianceOpenCount: criticalCount,
  });
  const summary = buildClosingReadinessSummary(criteria);
  const snapshot = {
    criteria,
    readinessPct: summary.readinessPct,
    eligibleForFinalReview: summary.eligibleForFinalReview,
    computed_at: new Date().toISOString(),
  };

  const reviewResult = await ensureSpvClosingReview(admin, {
    spvOpportunityId,
    companyId: record.company_id,
    snapshot,
  });
  if (reviewResult.error) {
    return { error: reviewResult.error };
  }

  const review = reviewResult.data!;
  const investorStatus = computeInvestorClosingPublicStatus({
    reviewStatus: review.status,
    spvStatus: record.status,
    cachedStatus: record.investor_closing_status,
    eligibleForFinalReview: summary.eligibleForFinalReview,
  });

  const companyName =
    (Array.isArray(record.companies) ? record.companies[0] : record.companies)?.company_name ??
    "Company";

  const notifyFinalReview =
    summary.eligibleForFinalReview &&
    record.status === "open" &&
    !record.closing_final_review_notified &&
    review.status === "not_started";

  const notifyFounderApproved =
    review.status === "approved_for_closing" && !record.closing_approved_notified;

  await admin
    .from("spv_opportunities")
    .update({
      closing_readiness_pct: summary.readinessPct,
      investor_closing_status: investorStatus,
      closing_final_review_notified: notifyFinalReview
        ? true
        : (record.closing_final_review_notified ?? false),
      closing_approved_notified: notifyFounderApproved
        ? true
        : (record.closing_approved_notified ?? false),
      updated_at: new Date().toISOString(),
    })
    .eq("id", spvOpportunityId);

  if (notifyFinalReview) {
    void notifyStaffSpvReadyForFinalReview({
      spvOpportunityId,
      spvName: record.name,
      companyName,
      actorId: input.actorId,
    });
  }

  if (notifyFounderApproved) {
    void notifyFounderSpvApprovedForClosing({
      companyId: record.company_id,
      spvOpportunityId,
      spvName: record.name,
      actorId: input.actorId,
    });
  }

  return { summary, review, investorClosingStatus: investorStatus };
}

export async function updateSpvClosingReview(
  admin: SupabaseClient<Database>,
  input: {
    reviewId: string;
    status: SpvClosingReviewStatus;
    internalNotes?: string | null;
    closingTargetOverride?: boolean;
    actorId: string;
  },
) {
  const { data: existing, error: loadError } = await admin
    .from("spv_closing_reviews")
    .select("*, spv_opportunities(name, status, company_id, closing_approved_notified, companies(company_name))")
    .eq("id", input.reviewId)
    .single();

  if (loadError || !existing) {
    return { error: loadError ?? new Error("Closing review not found.") };
  }

  const review = existing as SpvClosingReviewRecord & {
    spv_opportunities?: {
      name?: string;
      status?: string;
      company_id?: string;
      closing_approved_notified?: boolean;
      companies?: { company_name?: string | null } | { company_name?: string | null }[] | null;
    } | null;
  };

  const spvNested = Array.isArray(review.spv_opportunities)
    ? review.spv_opportunities[0]
    : review.spv_opportunities;
  const spvName = spvNested?.name ?? "SPV";
  const companyId = review.company_id;
  const companyName =
    (Array.isArray(spvNested?.companies) ? spvNested?.companies[0] : spvNested?.companies)
      ?.company_name ?? "Company";

  if (input.closingTargetOverride !== undefined) {
    await admin
      .from("spv_opportunities")
      .update({
        closing_target_override: input.closingTargetOverride,
        updated_at: new Date().toISOString(),
      })
      .eq("id", review.spv_opportunity_id);
  }

  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["spv_closing_reviews"]["Update"] = {
    status: input.status,
    updated_at: now,
  };

  if (input.internalNotes !== undefined) {
    patch.internal_notes = input.internalNotes?.trim() ?? null;
  }

  if (["in_review", "approved_for_closing", "changes_required", "closed_operationally"].includes(input.status)) {
    patch.reviewed_by = input.actorId;
    patch.reviewed_at = now;
  }

  const { data, error } = await admin
    .from("spv_closing_reviews")
    .update(patch)
    .eq("id", input.reviewId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update closing review.") };
  }

  if (input.status === "closed_operationally") {
    await admin
      .from("spv_opportunities")
      .update({
        status: "closed",
        operational_readiness_status: "closed",
        updated_at: now,
      })
      .eq("id", review.spv_opportunity_id);

    const { data: participations } = await admin
      .from("spv_participations")
      .select("investor_id, status")
      .eq("spv_opportunity_id", review.spv_opportunity_id);

    for (const row of (participations ?? []).filter(
      (part) => !["declined", "canceled"].includes(part.status),
    )) {
      void notifyInvestorSpvOperationallyClosed({
        investorId: row.investor_id,
        spvOpportunityId: review.spv_opportunity_id,
        spvName,
        actorId: input.actorId,
      });
    }
  }

  await syncSpvClosingReadiness(admin, review.spv_opportunity_id, { actorId: input.actorId });

  if (
    input.status === "approved_for_closing" &&
    existing.status !== "approved_for_closing" &&
    !spvNested?.closing_approved_notified
  ) {
    void notifyFounderSpvApprovedForClosing({
      companyId,
      spvOpportunityId: review.spv_opportunity_id,
      spvName,
      actorId: input.actorId,
    });
    await admin
      .from("spv_opportunities")
      .update({ closing_approved_notified: true, updated_at: now })
      .eq("id", review.spv_opportunity_id);
  }

  return { data: data as SpvClosingReviewRecord };
}
