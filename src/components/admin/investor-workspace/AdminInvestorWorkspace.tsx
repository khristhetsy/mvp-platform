"use client";

import Link from "next/link";
import { AdminInvestorReviewCard } from "@/components/AdminInvestorReviewCard";
import { InvestorCompliancePanel } from "@/components/admin/investor-workspace/InvestorCompliancePanel";
import { InvestorEngagementPanel } from "@/components/admin/investor-workspace/InvestorEngagementPanel";
import { InvestorCompanyRelationshipsPanel } from "@/components/admin/investor-workspace/InvestorCompanyRelationshipsPanel";
import { InvestorProfilePanel } from "@/components/admin/investor-workspace/InvestorProfilePanel";
import { InvestorQueuesPanel } from "@/components/admin/investor-workspace/InvestorQueuesPanel";
import { InvestorSpvPanel } from "@/components/admin/investor-workspace/InvestorSpvPanel";
import { InvestorTimelinePanel } from "@/components/admin/investor-workspace/InvestorTimelinePanel";
import { InvestorWorkspaceActionsPanel } from "@/components/admin/investor-workspace/InvestorWorkspaceActionsPanel";
import { InvestorWorkspaceHeader } from "@/components/admin/investor-workspace/InvestorWorkspaceHeader";
import { PageSection } from "@/components/ui/workspace-layout";
import type { AdminInvestorWorkspaceData } from "@/lib/admin/investor-workspace-types";

export function AdminInvestorWorkspace({ data }: Readonly<{ data: AdminInvestorWorkspaceData }>) {
  const reviewRow = {
    ...data.investor,
    matchingSummary: data.investor.matchingSummary,
  };

  return (
    <div className="space-y-6">
      <InvestorWorkspaceHeader data={data} />

      <PageSection title="Operational timeline" subtitle="Investor-scoped events from operational_activity_events">
        <InvestorTimelinePanel items={data.timeline} profileId={data.profileId} />
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Investor profile" subtitle="Onboarding and approval metadata">
          <InvestorProfilePanel investor={data.investor} />
        </PageSection>

        <PageSection title="Engagement summary" subtitle="Aggregates only — no message bodies">
          <InvestorEngagementPanel engagement={data.engagement} profileId={data.profileId} />
        </PageSection>
      </div>

      <PageSection title="Company relationships" subtitle="Companies connected through engagement and SPV activity">
        <InvestorCompanyRelationshipsPanel companies={data.companies} />
      </PageSection>

      <PageSection title="SPV participation" subtitle="Source: spv_participations">
        <InvestorSpvPanel participations={data.spvParticipations} profileId={data.profileId} />
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection title="Compliance & review notes" subtitle="Source: compliance_events, investor_profiles">
          <InvestorCompliancePanel compliance={data.compliance} profileId={data.profileId} />
        </PageSection>

        <PageSection title="Active queues" subtitle="Items affecting this investor across operational queues">
          <InvestorQueuesPanel items={data.queueItems} profileId={data.profileId} />
        </PageSection>
      </div>

      <PageSection title="Reports & actions" subtitle="Pre-filtered admin destinations">
        <InvestorWorkspaceActionsPanel
          profileId={data.profileId}
          investorName={data.investor.profiles?.full_name ?? data.investor.profiles?.email ?? "Investor"}
        />
      </PageSection>

      <PageSection
        title="Review & approval actions"
        subtitle="Same controls as the investors list — changes apply immediately"
        action={
          <Link href="/admin/investors" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Back to all investors
          </Link>
        }
      >
        <AdminInvestorReviewCard row={reviewRow} />
      </PageSection>
    </div>
  );
}
