import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminAuditCenter } from "@/components/admin/audit/AdminAuditCenter";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getAuditComplianceTimeline } from "@/lib/audit-compliance/audit-trail";
import { buildComplianceEvidencePack } from "@/lib/audit-compliance/evidence";
import { parseAuditComplianceFilters } from "@/lib/audit-compliance/filters";
import { getAuditRiskSummary } from "@/lib/audit-compliance/risk-summary";
import type { AuditEvidenceEntityType } from "@/lib/audit-compliance/types";
import { AUDIT_EVIDENCE_ENTITY_TYPES } from "@/lib/audit-compliance/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
    else if (Array.isArray(value) && value[0]) urlParams.set(key, value[0]);
  }

  const filters = parseAuditComplianceFilters(urlParams);
  const supabase = createServiceRoleClient();

  const evidenceType = urlParams.get("evidenceType") as AuditEvidenceEntityType | null;
  const evidenceId = urlParams.get("evidenceId");

  const [timeline, riskSummary, evidencePack] = await Promise.all([
    getAuditComplianceTimeline(supabase, filters).catch(() => []),
    getAuditRiskSummary(supabase).catch(() => ({
      openCriticalCompliance: 0,
      openHighCompliance: 0,
      overdueActions: 0,
      escalatedWorkflows: 0,
      failedAutomationRunsToday: 0,
      failedOrchestrationRunsToday: 0,
      failedImportsToday: 0,
      unresolvedSpvBlockers: 0,
      companiesWithRepeatedFlags: 0,
    })),
    evidenceType &&
    evidenceId &&
    AUDIT_EVIDENCE_ENTITY_TYPES.includes(evidenceType)
      ? buildComplianceEvidencePack(supabase, evidenceType, evidenceId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Audit & compliance"
          title="Enterprise audit center"
          description="Audit-grade operational oversight across compliance, automation, orchestration, imports, and collaboration metadata. Not legal advice."
          metadata="Staff only · sanitized exports"
          actions={
            <a
              href="/admin/compliance"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Compliance center
            </a>
          }
        />
        <Suspense fallback={<p className="text-sm text-slate-600">Loading audit center…</p>}>
          <AdminAuditCenter
            timeline={timeline}
            riskSummary={riskSummary}
            evidencePack={evidencePack}
            initialEntityType={evidenceType ?? undefined}
            initialEntityId={evidenceId ?? undefined}
          />
        </Suspense>
      </WorkspacePageContainer>
    </AppShell>
  );
}
