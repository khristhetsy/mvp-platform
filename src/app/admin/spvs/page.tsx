import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminSpvDashboardKpis } from "@/components/AdminSpvDashboardKpis";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import { AdminSpvsModuleViews } from "@/components/admin/AdminSpvsModuleViews";
import { buildAdminSpvDashboardMetrics } from "@/lib/spv/readiness";
import { listAdminChecklistGrouped } from "@/lib/spv/checklist";
import {
  buildClosingReadinessSummary,
  computeClosingReadinessCriteria,
  countCriticalOpenComplianceForCompany,
  listAdminClosingReviewsBySpv,
} from "@/lib/spv/closing-reviews";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import { listAdminPackagesGrouped } from "@/lib/spv/document-packages";
import { listAdminRequirementsGrouped } from "@/lib/spv/participation-requirements";
import {
  listAdminCompaniesForSpv,
  listAdminSpvOpportunities,
  listSpvParticipationsForOpportunity,
} from "@/lib/spv/spv-workflow";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import type { SpvParticipationRecord } from "@/lib/spv/types";

export const dynamic = "force-dynamic";

export default async function AdminSpvsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const [oppsResult, companies] = await Promise.all([
    listAdminSpvOpportunities(admin),
    listAdminCompaniesForSpv(admin),
  ]);

  const opportunities = oppsResult.data ?? [];
  const participationsBySpv: Record<string, SpvParticipationRecord[]> = {};
  const checklistResult = await listAdminChecklistGrouped(
    admin,
    opportunities.map((spv) => spv.id),
  );
  const checklistBySpv: Record<string, SpvChecklistItemRecord[]> =
    "data" in checklistResult ? (checklistResult.data ?? {}) : {};

  const requirementsResult = await listAdminRequirementsGrouped(
    admin,
    opportunities.map((spv) => spv.id),
  );
  const requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]> =
    "data" in requirementsResult ? (requirementsResult.data ?? {}) : {};

  const packagesResult = await listAdminPackagesGrouped(
    admin,
    opportunities.map((spv) => spv.id),
  );
  const packagesBySpv: Record<string, SpvDocumentPackageRecord[]> =
    "data" in packagesResult ? (packagesResult.data ?? {}) : {};

  for (const spv of opportunities) {
    const { data } = await listSpvParticipationsForOpportunity(admin, spv.id);
    participationsBySpv[spv.id] = data ?? [];
  }

  const requirementsBySpv: Record<string, SpvParticipationRequirementRecord[]> = {};
  for (const rows of Object.values(requirementsByParticipation)) {
    for (const row of rows) {
      const list = requirementsBySpv[row.spv_opportunity_id] ?? [];
      list.push(row);
      requirementsBySpv[row.spv_opportunity_id] = list;
    }
  }

  const companyIds = [...new Set(opportunities.map((spv) => spv.company_id))];
  const criticalComplianceByCompany: Record<string, number> = {};
  for (const companyId of companyIds) {
    const counted = await countCriticalOpenComplianceForCompany(admin, companyId);
    criticalComplianceByCompany[companyId] = counted.count;
  }

  const closingReadinessBySpv: Record<string, ClosingReadinessSummary> = {};
  for (const spv of opportunities) {
    const criteria = computeClosingReadinessCriteria({
      spv,
      checklist: checklistBySpv[spv.id] ?? [],
      participations: participationsBySpv[spv.id] ?? [],
      requirements: requirementsBySpv[spv.id] ?? [],
      packages: packagesBySpv[spv.id] ?? [],
      criticalComplianceOpenCount: criticalComplianceByCompany[spv.company_id] ?? 0,
    });
    closingReadinessBySpv[spv.id] = buildClosingReadinessSummary(criteria);
  }

  const closingReviewsResult = await listAdminClosingReviewsBySpv(
    admin,
    opportunities.map((spv) => spv.id),
  );
  const closingReviewsBySpv: Record<string, SpvClosingReviewRecord> =
    "data" in closingReviewsResult ? (closingReviewsResult.data ?? {}) : {};

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <PageHeader
        eyebrow="SPV operations"
        title="SPV command center"
        description="Readiness, investor document intake, and indicative participation. Use Refresh readiness per SPV — no sync on page load."
        metadata="Operational tracking only — not legal formation or securities execution"
      />

      <AdminSpvDashboardKpis
        metrics={buildAdminSpvDashboardMetrics(
          opportunities,
          participationsBySpv,
          requirementsByParticipation,
        )}
      />

      <div className="mt-8">
        <AdminSpvsModuleViews>
          {(listViewMode, listDensity, listQuery) => (
            <AdminSpvManagement
              opportunities={opportunities}
              participationsBySpv={participationsBySpv}
              checklistBySpv={checklistBySpv}
              requirementsByParticipation={requirementsByParticipation}
              packagesBySpv={packagesBySpv}
              closingReviewsBySpv={closingReviewsBySpv}
              closingReadinessBySpv={closingReadinessBySpv}
              companies={companies.map((c) => ({ id: c.id, name: c.company_name }))}
              listViewMode={listViewMode}
              listDensity={listDensity}
              listQuery={listQuery}
            />
          )}
        </AdminSpvsModuleViews>
      </div>
    </AppShell>
  );
}
