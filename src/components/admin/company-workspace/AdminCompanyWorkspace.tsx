"use client";

import Link from "next/link";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import { CompanyCompliancePanel } from "@/components/admin/company-workspace/CompanyCompliancePanel";
import { CompanyDocumentsPanel } from "@/components/admin/company-workspace/CompanyDocumentsPanel";
import { CompanyInvestorActivityPanel } from "@/components/admin/company-workspace/CompanyInvestorActivityPanel";
import { CompanyQueuesPanel } from "@/components/admin/company-workspace/CompanyQueuesPanel";
import { CompanyReadinessPanel } from "@/components/admin/company-workspace/CompanyReadinessPanel";
import { CompanySpvPanel } from "@/components/admin/company-workspace/CompanySpvPanel";
import { CompanyTimelinePanel } from "@/components/admin/company-workspace/CompanyTimelinePanel";
import { CompanyWorkspaceHeader } from "@/components/admin/company-workspace/CompanyWorkspaceHeader";
import { CompanyWorkspaceReportsPanel } from "@/components/admin/company-workspace/CompanyWorkspaceReportsPanel";
import { PageSection } from "@/components/ui/workspace-layout";
import type { AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";

export function AdminCompanyWorkspace({ data }: Readonly<{ data: AdminCompanyWorkspaceData }>) {
  return (
    <div className="space-y-6">
      <CompanyWorkspaceHeader data={data} />

      <PageSection title="Operational timeline" subtitle="Company-scoped events from operational_activity_events">
        <CompanyTimelinePanel items={data.timeline} companyId={data.company.id} />
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Readiness" subtitle="Source: diligence reports, onboarding, remediation">
          <CompanyReadinessPanel readiness={data.readiness} companyId={data.company.id} />
        </PageSection>

        <PageSection title="Investor activity" subtitle="Aggregates only — no message bodies">
          <CompanyInvestorActivityPanel activity={data.investorActivity} companyId={data.company.id} />
        </PageSection>
      </div>

      <PageSection title="SPV operations" subtitle="Source: spv_opportunities">
        <CompanySpvPanel spvs={data.spvs} companyId={data.company.id} />
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Compliance" subtitle="Source: compliance_events">
          <CompanyCompliancePanel compliance={data.compliance} companyId={data.company.id} />
        </PageSection>

        <PageSection title="Documents & diligence" subtitle="Source: documents, diligence_reports">
          <CompanyDocumentsPanel documents={data.documents} companyId={data.company.id} />
        </PageSection>
      </div>

      <PageSection title="Active queues" subtitle="Items affecting this company across operational queues">
        <CompanyQueuesPanel items={data.queueItems} companyId={data.company.id} />
      </PageSection>

      <PageSection title="Reports & exports" subtitle="Pre-filtered admin report links">
        <CompanyWorkspaceReportsPanel companyId={data.company.id} companyName={data.company.company_name} />
      </PageSection>

      <PageSection
        title="Review & marketplace actions"
        subtitle="Same controls as the companies list — changes apply immediately"
        action={
          <Link href="/admin/companies" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Back to all companies
          </Link>
        }
      >
        <AdminCompanyCard company={data.company} />
      </PageSection>
    </div>
  );
}
