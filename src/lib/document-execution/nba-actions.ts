import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeSpvExecutionReadiness } from "@/lib/document-execution/readiness";
import { buildActionId, createNextBestAction } from "@/lib/next-best-actions/action-catalog";
import type { NextBestAction } from "@/lib/next-best-actions/types";
import { countCriticalOpenComplianceForCompany } from "@/lib/spv/closing-reviews";
import { listAdminPackagesGrouped } from "@/lib/spv/document-packages";
import { listAdminClosingReviewsBySpv } from "@/lib/spv/closing-reviews";
import { listAdminRequirementsGrouped } from "@/lib/spv/participation-requirements";
import { listAdminSpvOpportunities, listSpvParticipationsForOpportunity } from "@/lib/spv/spv-workflow";
import type { SpvParticipationRequirementRecord } from "@/lib/spv/types";

export async function loadDocumentExecutionNbaActions(
  role: "admin" | "analyst",
  entityFilter?: { entityType?: string; entityId?: string },
  limit = 4,
): Promise<NextBestAction[]> {
  const admin = createServiceRoleClient();
  const { data: opportunities } = await listAdminSpvOpportunities(admin);
  if (!opportunities?.length) return [];

  let spvs = opportunities;
  if (entityFilter?.entityType === "spv" && entityFilter.entityId) {
    spvs = opportunities.filter((s) => s.id === entityFilter.entityId);
  } else if (entityFilter?.entityType === "company" && entityFilter.entityId) {
    spvs = opportunities.filter((s) => s.company_id === entityFilter.entityId);
  }

  spvs = spvs.slice(0, 12);
  const spvIds = spvs.map((s) => s.id);

  const [packagesResult, closingResult, requirementsResult] = await Promise.all([
    listAdminPackagesGrouped(admin, spvIds),
    listAdminClosingReviewsBySpv(admin, spvIds),
    listAdminRequirementsGrouped(admin, spvIds),
  ]);

  const packagesBySpv = "data" in packagesResult ? packagesResult.data ?? {} : {};
  const closingBySpv = "data" in closingResult ? closingResult.data ?? {} : {};
  const requirementsByParticipation =
    "data" in requirementsResult ? requirementsResult.data ?? {} : {};

  const actions: NextBestAction[] = [];

  for (const spv of spvs) {
    const participations = (await listSpvParticipationsForOpportunity(admin, spv.id)).data ?? [];
    const requirements: SpvParticipationRequirementRecord[] = [];
    for (const rows of Object.values(requirementsByParticipation)) {
      for (const row of rows) {
        if (row.spv_opportunity_id === spv.id) {
          requirements.push(row);
        }
      }
    }

    const critical = await countCriticalOpenComplianceForCompany(admin, spv.company_id);
    const summary = computeSpvExecutionReadiness({
      spv,
      packages: packagesBySpv[spv.id] ?? [],
      participations,
      requirements,
      closingReview: closingBySpv[spv.id] ?? null,
      criticalComplianceOpenCount: critical.count,
      hasFounderSigner: Boolean(spv.created_by),
    });

    if (summary.complianceBlocked) {
      actions.push(
        createNextBestAction({
          id: buildActionId(["admin", "exec_compliance", spv.id]),
          role,
          title: `Execution blocked: compliance — ${spv.name}`,
          description: summary.nextRequiredStep,
          priority: "critical",
          category: "spv",
          entityType: "spv",
          entityId: spv.id,
          spvId: spv.id,
          companyId: spv.company_id,
          href: "/admin/spvs",
          sourceModule: "document_execution",
          reason: "Critical compliance open",
          createdFrom: "document_execution",
        }),
      );
      continue;
    }

    const closingOk =
      summary.closingReviewStatus === "approved_for_closing" ||
      summary.closingReviewStatus === "closed_operationally";
    if (!closingOk) {
      actions.push(
        createNextBestAction({
          id: buildActionId(["admin", "exec_closing", spv.id]),
          role,
          title: `Closing review incomplete — ${spv.name}`,
          description: "Closing review must be approved before document execution readiness is complete.",
          priority: "high",
          category: "spv",
          entityType: "spv",
          entityId: spv.id,
          spvId: spv.id,
          companyId: spv.company_id,
          href: "/admin/spvs",
          sourceModule: "document_execution",
          reason: "Closing review not approved",
          createdFrom: "document_execution",
        }),
      );
    }

    for (const pkg of summary.blockedPackages.slice(0, 2)) {
      actions.push(
        createNextBestAction({
          id: buildActionId(["admin", "exec_pkg", spv.id, pkg.kind]),
          role,
          title: `Execution package incomplete: ${pkg.label}`,
          description: pkg.nextRequiredStep,
          priority: "high",
          category: "spv",
          entityType: "spv",
          entityId: spv.id,
          spvId: spv.id,
          companyId: spv.company_id,
          href: "/admin/spvs",
          sourceModule: "document_execution",
          reason: pkg.blockedReason ?? "Package not ready",
          createdFrom: "document_execution",
        }),
      );
    }

    const missingSigner = summary.signers.find((s) => s.status !== "present");
    if (missingSigner) {
      actions.push(
        createNextBestAction({
          id: buildActionId(["admin", "exec_signer", spv.id, missingSigner.signerType]),
          role,
          title: `Signer readiness: ${missingSigner.label}`,
          description: missingSigner.blockedReason ?? "Complete signer prerequisites",
          priority: "medium",
          category: "spv",
          entityType: "spv",
          entityId: spv.id,
          spvId: spv.id,
          companyId: spv.company_id,
          href: "/admin/spvs",
          sourceModule: "document_execution",
          reason: "Signer missing",
          createdFrom: "document_execution",
        }),
      );
    }
  }

  return actions.slice(0, limit);
}
