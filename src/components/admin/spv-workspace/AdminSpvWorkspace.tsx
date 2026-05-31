"use client";

import Link from "next/link";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import { SpvClosingPanel } from "@/components/admin/spv-workspace/SpvClosingPanel";
import { SpvCompliancePanel } from "@/components/admin/spv-workspace/SpvCompliancePanel";
import { SpvInvestorParticipationPanel } from "@/components/admin/spv-workspace/SpvInvestorParticipationPanel";
import { SpvPackagesPanel } from "@/components/admin/spv-workspace/SpvPackagesPanel";
import { SpvQueuesPanel } from "@/components/admin/spv-workspace/SpvQueuesPanel";
import { SpvReadinessPanel } from "@/components/admin/spv-workspace/SpvReadinessPanel";
import { SpvReportsPanel } from "@/components/admin/spv-workspace/SpvReportsPanel";
import { SpvRequirementsPanel } from "@/components/admin/spv-workspace/SpvRequirementsPanel";
import { SpvTimelinePanel } from "@/components/admin/spv-workspace/SpvTimelinePanel";
import { SpvWorkspaceHeader } from "@/components/admin/spv-workspace/SpvWorkspaceHeader";
import { PageSection } from "@/components/ui/workspace-layout";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";

export function AdminSpvWorkspace({ data }: Readonly<{ data: AdminSpvWorkspaceData }>) {
  return (
    <div className="space-y-6">
      <SpvWorkspaceHeader data={data} />

      <PageSection title="Operational timeline" subtitle="SPV-scoped events from operational_activity_events">
        <SpvTimelinePanel items={data.timeline} spvId={data.spv.id} companyId={data.company.id} />
      </PageSection>

      <PageSection title="Readiness summary" subtitle="Existing operational readiness logic — no schema changes">
        <SpvReadinessPanel readiness={data.readiness} />
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Investor participation" subtitle="Aggregate participation — no uploaded documents">
          <SpvInvestorParticipationPanel participation={data.participation} spvId={data.spv.id} />
        </PageSection>

        <PageSection title="Investor requirements" subtitle="Requirement status counts and latest updates">
          <SpvRequirementsPanel
            requirements={data.requirements}
            spvId={data.spv.id}
            companyId={data.company.id}
          />
        </PageSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Document packages" subtitle="Source: spv_document_packages">
          <SpvPackagesPanel packages={data.packages} />
        </PageSection>

        <PageSection title="Closing review" subtitle="Operational closing readiness — not legal execution">
          <div id="spv-closing-review">
            <SpvClosingPanel closing={data.closing} spvId={data.spv.id} companyId={data.company.id} />
          </div>
        </PageSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Compliance" subtitle="Company-scoped events related to this SPV">
          <SpvCompliancePanel compliance={data.compliance} spvId={data.spv.id} companyId={data.company.id} />
        </PageSection>

        <PageSection title="Active queues" subtitle="Operational queue entries for this SPV">
          <SpvQueuesPanel items={data.queueItems} spvId={data.spv.id} companyId={data.company.id} />
        </PageSection>
      </div>

      <PageSection title="Reports & actions" subtitle="Pre-filtered admin report links">
        <SpvReportsPanel spvId={data.spv.id} companyId={data.company.id} companyName={data.company.name} />
      </PageSection>

      <PageSection
        title="SPV management actions"
        subtitle="Same controls as the SPV command center — changes apply immediately"
        action={
          <Link href="/admin/spvs" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Back to all SPVs
          </Link>
        }
      >
        <div id="spv-management">
          <AdminSpvManagement {...data.management} listViewMode="card" />
        </div>
      </PageSection>
    </div>
  );
}
