import { AppShell } from "@/components/AppShell";
import { AdminSpvDashboardKpis } from "@/components/AdminSpvDashboardKpis";
import { AdminSpvsModuleViews } from "@/components/admin/AdminSpvsModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer, PageSection } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatError } from "@/lib/errors/format-error";
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
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveSpvDependencies } from "@/lib/automation/dependencies";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { WorkflowDependencyPanel } from "@/components/workflow/WorkflowDependencyPanel";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";

export const dynamic = "force-dynamic";

type SpvWorkspaceData = {
  opportunities: SpvOpportunityRecord[];
  companies: Array<{ id: string; name: string }>;
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
};

async function loadAdminSpvWorkspace(): Promise<{ data: SpvWorkspaceData | null; error: string | null }> {
  try {
    const admin = createServiceRoleClient();

    const [oppsResult, companiesRaw] = await Promise.all([
      listAdminSpvOpportunities(admin),
      listAdminCompaniesForSpv(admin),
    ]);

    if (oppsResult.error) {
      return { data: null, error: oppsResult.error.message ?? "Failed to load SPV opportunities." };
    }

    const opportunities = oppsResult.data ?? [];
    const companies = (companiesRaw ?? []).map((c) => ({ id: c.id, name: c.company_name }));
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

    await Promise.all(
      opportunities.map(async (spv) => {
        const result = await listSpvParticipationsForOpportunity(admin, spv.id);
        participationsBySpv[spv.id] = result.data ?? [];
      }),
    );

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
    await Promise.all(
      companyIds.map(async (companyId) => {
        const counted = await countCriticalOpenComplianceForCompany(admin, companyId);
        criticalComplianceByCompany[companyId] = counted.count;
      }),
    );

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

    return {
      data: {
        opportunities,
        companies,
        participationsBySpv,
        checklistBySpv,
        requirementsByParticipation,
        packagesBySpv,
        closingReviewsBySpv,
        closingReadinessBySpv,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: formatError(error) ?? "Failed to load SPV workspace." };
  }
}

export default async function AdminSpvsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = await createServerSupabaseClient();
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";
  const [{ data, error: loadError }, nextBestActions] = await Promise.all([
    loadAdminSpvWorkspace(),
    loadAndMergeNextBestActions({
      profile,
      supabase,
      options: { role: adminRole, limit: 3, sync: true },
    }),
  ]);

  const opportunities = data?.opportunities ?? [];
  const companies = data?.companies ?? [];
  const primarySpvId = opportunities[0]?.id;
  const spvDependencies = primarySpvId
    ? await resolveSpvDependencies(supabase, primarySpvId).catch(() => [])
    : [];

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="SPV operations"
          title="SPV command center"
          description="Readiness, investor document intake, and indicative participation. Use Refresh readiness per SPV — no sync on page load."
          metadata="Operational tracking only — not legal formation or securities execution"
        />

        {loadError ? (
          <WorkspacePanel title="SPV workspace unavailable" subtitle="Admin SPV data could not be loaded">
            <p className="text-sm text-red-800">{loadError}</p>
            <p className="mt-3 text-xs text-slate-600">
              Verify Supabase service role configuration and SPV table migrations, then reload this page.
            </p>
          </WorkspacePanel>
        ) : (
          <>
            <NextBestActionsPanel
              role={adminRole}
              initialActions={nextBestActions.actions}
              limit={3}
              className="mb-6"
              showEscalate
            />

            {spvDependencies.length > 0 ? (
              <div className="mb-6">
                <WorkflowDependencyPanel
                  dependencies={spvDependencies}
                  title={primarySpvId ? "SPV workflow blockers (primary opportunity)" : "SPV workflow blockers"}
                />
              </div>
            ) : null}

            {primarySpvId ? (
              <div className="mb-6">
                <CollaborationDiscussionPanel entityType="spv" entityId={primarySpvId} title="SPV discussion" />
              </div>
            ) : null}

            <PageSection title="Operations overview" subtitle="Non-binding indicative totals">
              <AdminSpvDashboardKpis
                metrics={buildAdminSpvDashboardMetrics(
                  opportunities,
                  data?.participationsBySpv ?? {},
                  data?.requirementsByParticipation ?? {},
                )}
              />
            </PageSection>

            <AdminSpvsModuleViews
              opportunities={opportunities}
              participationsBySpv={data?.participationsBySpv ?? {}}
              checklistBySpv={data?.checklistBySpv ?? {}}
              requirementsByParticipation={data?.requirementsByParticipation ?? {}}
              packagesBySpv={data?.packagesBySpv ?? {}}
              closingReviewsBySpv={data?.closingReviewsBySpv ?? {}}
              closingReadinessBySpv={data?.closingReadinessBySpv ?? {}}
              companies={companies}
            />
          </>
        )}
      </WorkspacePageContainer>
    </AppShell>
  );
}
