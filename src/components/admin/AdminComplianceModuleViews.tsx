"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { AdminComplianceQueue } from "@/components/AdminComplianceQueue";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { MetricCard } from "@/components/MetricCard";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { ComplianceEventRecord } from "@/lib/compliance/types";
import type { FounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import {
  filterComplianceEvents,
  type ComplianceQueryFilters,
} from "@/lib/ui/query-filters";

type ComplianceMetrics = {
  openEvents: number;
  criticalEvents: number;
  highEvents: number;
  underReview: number;
};

type Props = Readonly<{
  metrics: ComplianceMetrics;
  openQueue: ComplianceEventRecord[];
  outreach: FounderOutreachAdminSummary;
  sections: {
    founderReadinessRisk: Array<{
      companyId: string;
      companyName: string;
      readinessScore: number | null;
      onboardingPercent: number;
    }>;
    investorApprovalReview: Array<{ profile_id: string; approval_status: string }>;
    socialCompliance: ComplianceEventRecord[];
    messagingFlags: ComplianceEventRecord[];
    platformAlerts: ComplianceEventRecord[];
    subscriptionRisk: { pendingUpgrades: number; expiredTrials: number };
    outreachCompliance: { events: ComplianceEventRecord[] };
    companyProfiles: Array<{
      companyId: string;
      companyName: string;
      readinessScore: number | null;
      remediationOpen: number;
      socialFlagged: number;
    }>;
    highRiskCompanies: Array<{
      companyId: string;
      companyName: string;
      reviewStatus: string | null;
      readinessScore: number | null;
      remediationOpen: number;
      outreachTargets: number;
      openEvents: number;
    }>;
  };
}>;

function filterSectionEvents(events: ComplianceEventRecord[], filters: ComplianceQueryFilters) {
  return filterComplianceEvents(events, filters);
}

function hasSectionDrilldown(filters: ComplianceQueryFilters) {
  return Boolean(
    filters.status ||
      filters.severity ||
      filters.company ||
      filters.investor ||
      filters.event ||
      filters.q.trim(),
  );
}

function AdminComplianceModuleViewsInner(props: Props) {
  const { filters } = useAdminQueryFilters("compliance");
  const complianceFilters = filters as ComplianceQueryFilters;

  const filteredOpenQueue = useMemo(
    () => filterComplianceEvents(props.openQueue, complianceFilters),
    [props.openQueue, complianceFilters],
  );

  const filteredSocial = useMemo(
    () => filterSectionEvents(props.sections.socialCompliance, complianceFilters),
    [props.sections.socialCompliance, complianceFilters],
  );

  const filteredMessaging = useMemo(
    () => filterSectionEvents(props.sections.messagingFlags, complianceFilters),
    [props.sections.messagingFlags, complianceFilters],
  );

  const filteredPlatform = useMemo(
    () => filterSectionEvents(props.sections.platformAlerts, complianceFilters),
    [props.sections.platformAlerts, complianceFilters],
  );

  const filteredOutreachEvents = useMemo(
    () => filterSectionEvents(props.sections.outreachCompliance.events, complianceFilters),
    [props.sections.outreachCompliance.events, complianceFilters],
  );

  const hasDrilldown = hasSectionDrilldown(complianceFilters);

  return (
    <>
      <AdminQueryFilterBar page="compliance" className="mb-4" />

      <MetricRow title="Review queue indicators" subtitle="Open and under-review counts">
        <MetricCard label="Open events" value={String(props.metrics.openEvents)} detail="Requires staff review" accent="indigo" href="/admin/compliance" />
        <MetricCard label="Critical" value={String(props.metrics.criticalEvents)} detail="Open or under review" accent="violet" href="/admin/compliance" />
        <MetricCard label="High severity" value={String(props.metrics.highEvents)} detail="Open or under review" accent="blue" href="/admin/compliance" />
        <MetricCard label="Under review" value={String(props.metrics.underReview)} detail="Actively being reviewed" accent="slate" href="/admin/compliance" />
      </MetricRow>

      <section className="mt-8">
        <WorkspacePanel title="Compliance review queue" subtitle="Open events — internal notes are staff-only">
          {filteredOpenQueue.length === 0 ? (
            hasDrilldown ? (
              <ModuleEmptyState
                title="No matching compliance events"
                description="Try clearing filters or adjusting severity/status."
              />
            ) : (
              <AdminComplianceQueue events={[]} title="Open queue" />
            )
          ) : (
            <AdminComplianceQueue events={filteredOpenQueue} title="Open queue" />
          )}
        </WorkspacePanel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Founder readiness risk" subtitle="Low readiness scores (snapshot)">
          {props.sections.founderReadinessRisk.length === 0 ? (
            <p className="text-sm text-slate-500">No low-readiness companies flagged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.sections.founderReadinessRisk.map((row) => (
                <li key={row.companyId}>
                  <Link href={`/admin/companies`} className="font-medium text-indigo-700">
                    {row.companyName}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · readiness {row.readinessScore ?? "—"} · onboarding {row.onboardingPercent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Investor approval review" subtitle="Pending or changes requested">
          {props.sections.investorApprovalReview.length === 0 ? (
            <p className="text-sm text-slate-500">No investors awaiting review.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.sections.investorApprovalReview.map((row) => (
                <li key={row.profile_id}>
                  <Link href="/admin/investors" className="font-medium text-indigo-700">
                    Investor {row.profile_id.slice(0, 8)}
                  </Link>
                  <span className="text-slate-500"> · {row.approval_status}</span>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <AnalyticsBreakdownPanel
          title="Outreach compliance"
          subtitle="Aggregate outreach activity"
          rows={[
            { label: "Private contacts", value: String(props.outreach.privateContactCount) },
            { label: "Queued messages", value: String(props.outreach.queuedMessageCount) },
            { label: "Draft campaigns", value: String(props.outreach.draftCampaignCount) },
            { label: "Flagged social (DB)", value: String(props.outreach.socialDraftFlaggedCount) },
            { label: "Daily limit", value: "25 (platform cap)" },
          ]}
        />

        <WorkspacePanel title="Social draft compliance" subtitle="Flagged drafts in centralized queue">
          <AdminComplianceQueue events={filteredSocial} title="Social flags" />
        </WorkspacePanel>

        <WorkspacePanel title="Messaging risk flags" subtitle="Deterministic keyword rules">
          <AdminComplianceQueue events={filteredMessaging} title="Messaging" />
        </WorkspacePanel>

        <WorkspacePanel title="Platform activity alerts" subtitle="Onboarding, trial, high-risk companies">
          <AdminComplianceQueue events={filteredPlatform} title="Platform alerts" />
        </WorkspacePanel>

        <AnalyticsBreakdownPanel
          title="Subscription / payment risk"
          subtitle="Operational signals only — no payment processing"
          rows={[
            { label: "Pending upgrade requests", value: String(props.sections.subscriptionRisk.pendingUpgrades) },
            { label: "Expired founder trials", value: String(props.sections.subscriptionRisk.expiredTrials) },
          ]}
        />
      </section>

      <section className="mt-8">
        <WorkspacePanel title="High-risk companies" subtitle="Combined readiness, remediation, and outreach signals">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Review</th>
                  <th className="py-2 pr-4">Readiness</th>
                  <th className="py-2 pr-4">Remediation</th>
                  <th className="py-2 pr-4">Outreach</th>
                  <th className="py-2">Open events</th>
                </tr>
              </thead>
              <tbody>
                {props.sections.highRiskCompanies.map((row) => (
                  <tr key={row.companyId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.companyName}</td>
                    <td className="py-2 pr-4 text-slate-600">{row.reviewStatus ?? "—"}</td>
                    <td className="py-2 pr-4">{row.readinessScore ?? "—"}</td>
                    <td className="py-2 pr-4">{row.remediationOpen}</td>
                    <td className="py-2 pr-4">{row.outreachTargets}</td>
                    <td className="py-2">{row.openEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkspacePanel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Outreach compliance events" subtitle="Recent flagged outreach">
          <AdminComplianceQueue events={filteredOutreachEvents} title="Outreach events" />
        </WorkspacePanel>

        <WorkspacePanel title="Company compliance profiles" subtitle="Per-company snapshot (no founder PII beyond name)">
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {props.sections.companyProfiles.map((row) => (
              <p key={row.companyId}>
                <span className="font-medium">{row.companyName}</span>
                <span className="text-slate-500">
                  {" "}
                  · readiness {row.readinessScore ?? "—"} · remediation {row.remediationOpen} · social flagged{" "}
                  {row.socialFlagged}
                </span>
              </p>
            ))}
          </div>
        </WorkspacePanel>
      </section>
    </>
  );
}

export function AdminComplianceModuleViews(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
      <AdminComplianceModuleViewsInner {...props} />
    </Suspense>
  );
}
