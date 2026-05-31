import {
  notifyStaffSpvInvestorDocumentsPendingReview,
  notifyStaffSpvReadyForLegalDocs,
  notifyStaffSpvTargetAmountReached,
} from "@/lib/spv/notify";
import { getSpvParticipationTotals } from "@/lib/spv/display";
import {
  buildSpvReadinessContext,
  computeSpvOperationalReadinessStatus,
  countRequirementsPendingReview,
  type SpvReadinessContext,
} from "@/lib/spv/readiness";
import type {
  SpvChecklistItemRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function refreshSpvOperationalReadiness(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  input: {
    actorId: string | null;
    checklist?: SpvChecklistItemRecord[];
    participations?: SpvParticipationRecord[];
    requirements?: SpvParticipationRequirementRecord[];
  },
) {
  const { data: spv, error: spvError } = await admin
    .from("spv_opportunities")
    .select("*")
    .eq("id", spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV not found.") };
  }

  const record = spv as SpvOpportunityRecord;
  const previousStatus = record.operational_readiness_status ?? null;

  let participations = input.participations;
  if (!participations) {
    const { data } = await admin
      .from("spv_participations")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    participations = (data ?? []) as SpvParticipationRecord[];
  }

  let checklist = input.checklist;
  if (!checklist) {
    const { data } = await admin
      .from("spv_checklist_items")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    checklist = (data ?? []) as SpvChecklistItemRecord[];
  }

  let requirements = input.requirements;
  if (!requirements) {
    const { data } = await admin
      .from("spv_participation_requirements")
      .select("*")
      .eq("spv_opportunity_id", spvOpportunityId);
    requirements = (data ?? []) as SpvParticipationRequirementRecord[];
  }

  const requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]> = {};
  for (const row of requirements) {
    const list = requirementsByParticipation[row.spv_participation_id] ?? [];
    list.push(row);
    requirementsByParticipation[row.spv_participation_id] = list;
  }

  const ctx = buildSpvReadinessContext(record, checklist, participations, requirementsByParticipation);
  const readiness = computeSpvOperationalReadinessStatus(ctx);
  const pendingReview = countRequirementsPendingReview(requirements);
  const totals = getSpvParticipationTotals(
    participations.filter((row) => !["declined", "canceled"].includes(row.status)),
  );

  const companyName =
    (Array.isArray(record.companies) ? record.companies[0] : record.companies)?.company_name ??
    "Company";

  if (
    readiness === "ready_for_legal_docs" &&
    previousStatus !== "ready_for_legal_docs"
  ) {
    void notifyStaffSpvReadyForLegalDocs({
      spvOpportunityId,
      spvName: record.name,
      companyName,
      actorId: input.actorId,
    });
  }

  if (
    readiness === "investors_pending" &&
    pendingReview > 0 &&
    previousStatus !== "investors_pending"
  ) {
    void notifyStaffSpvInvestorDocumentsPendingReview({
      spvOpportunityId,
      spvName: record.name,
      companyName,
      pendingReviewCount: pendingReview,
      actorId: input.actorId,
    });
  }

  const target = record.target_amount != null ? Number(record.target_amount) : null;
  const targetReached =
    target != null &&
    target > 0 &&
    totals.indicativeTotal >= target &&
    record.status === "open" &&
    !record.target_amount_reached_notified;

  if (targetReached) {
    void notifyStaffSpvTargetAmountReached({
      spvOpportunityId,
      spvName: record.name,
      companyName,
      indicativeTotal: totals.indicativeTotal,
      targetAmount: target,
      actorId: input.actorId,
    });
  }

  const { error: updateError } = await admin
    .from("spv_opportunities")
    .update({
      operational_readiness_status: readiness,
      target_amount_reached_notified: targetReached
        ? true
        : (record.target_amount_reached_notified ?? false),
      updated_at: new Date().toISOString(),
    })
    .eq("id", spvOpportunityId);

  if (updateError) {
    return { error: updateError };
  }

  return { readiness, context: ctx as SpvReadinessContext };
}
