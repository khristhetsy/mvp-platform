"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("complianceAdmin");
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

      <MetricRow title={t("queueIndicators")} subtitle={t("openUnderReview")}>
        <MetricCard label={t("openEvents")} value={String(props.metrics.openEvents)} detail={t("requiresReview")} accent="indigo" href="/admin/compliance" />
        <MetricCard label={t("critical")} value={String(props.metrics.criticalEvents)} detail={t("openOrReview")} accent="violet" href="/admin/compliance" />
        <MetricCard label={t("highSeverity")} value={String(props.metrics.highEvents)} detail={t("openOrReview")} accent="blue" href="/admin/compliance" />
        <MetricCard label={t("underReview")} value={String(props.metrics.underReview)} detail={t("activelyReviewed")} accent="slate" href="/admin/compliance" />
      </MetricRow>

      <section className="mt-8">
        <WorkspacePanel title={t("reviewQueue")} subtitle={t("reviewQueueSub")}>
          {filteredOpenQueue.length === 0 ? (
            hasDrilldown ? (
              <ModuleEmptyState
                title={t("noMatching")}
                description={t("noMatchingDesc")}
              />
            ) : (
              <AdminComplianceQueue events={[]} title={t("openQueue")} />
            )
          ) : (
            <AdminComplianceQueue events={filteredOpenQueue} title={t("openQueue")} />
          )}
        </WorkspacePanel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title={t("founderRisk")} subtitle={t("founderRiskSub")}>
          {props.sections.founderReadinessRisk.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noLowReadiness")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.sections.founderReadinessRisk.map((row) => (
                <li key={row.companyId}>
                  <Link href={`/admin/companies`} className="font-medium text-indigo-700">
                    {row.companyName}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    {t("readinessRow", { score: row.readinessScore ?? "—", percent: row.onboardingPercent })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <WorkspacePanel title={t("investorReview")} subtitle={t("investorReviewSub")}>
          {props.sections.investorApprovalReview.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noInvestorsAwaiting")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.sections.investorApprovalReview.map((row) => (
                <li key={row.profile_id}>
                  <Link href="/admin/investors" className="font-medium text-indigo-700">
                    {t("investorPrefix")} {row.profile_id.slice(0, 8)}
                  </Link>
                  <span className="text-slate-500"> · {row.approval_status}</span>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <AnalyticsBreakdownPanel
          title={t("outreachCompliance")}
          subtitle={t("outreachComplianceSub")}
          rows={[
            { label: t("privateContacts"), value: String(props.outreach.privateContactCount) },
            { label: t("queuedMessages"), value: String(props.outreach.queuedMessageCount) },
            { label: t("draftCampaigns"), value: String(props.outreach.draftCampaignCount) },
            { label: t("flaggedSocial"), value: String(props.outreach.socialDraftFlaggedCount) },
            { label: t("dailyLimit"), value: t("platformCap") },
          ]}
        />

        <WorkspacePanel title={t("socialDraft")} subtitle={t("socialDraftSub")}>
          <AdminComplianceQueue events={filteredSocial} title={t("socialFlags")} />
        </WorkspacePanel>

        <WorkspacePanel title={t("messagingRisk")} subtitle={t("messagingRiskSub")}>
          <AdminComplianceQueue events={filteredMessaging} title={t("messaging")} />
        </WorkspacePanel>

        <WorkspacePanel title={t("platformAlerts")} subtitle={t("platformAlertsSub")}>
          <AdminComplianceQueue events={filteredPlatform} title={t("platformAlertsTitle")} />
        </WorkspacePanel>

        <AnalyticsBreakdownPanel
          title={t("subscriptionRisk")}
          subtitle={t("subscriptionRiskSub")}
          rows={[
            { label: t("pendingUpgrades"), value: String(props.sections.subscriptionRisk.pendingUpgrades) },
            { label: t("expiredTrials"), value: String(props.sections.subscriptionRisk.expiredTrials) },
          ]}
        />
      </section>

      <section className="mt-8">
        <WorkspacePanel title={t("highRisk")} subtitle={t("highRiskSub")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">{t("colCompany")}</th>
                  <th className="py-2 pr-4">{t("colReview")}</th>
                  <th className="py-2 pr-4">{t("colReadiness")}</th>
                  <th className="py-2 pr-4">{t("colRemediation")}</th>
                  <th className="py-2 pr-4">{t("colOutreach")}</th>
                  <th className="py-2">{t("colOpenEvents")}</th>
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
        <WorkspacePanel title={t("outreachEvents")} subtitle={t("outreachEventsSub")}>
          <AdminComplianceQueue events={filteredOutreachEvents} title={t("outreachEventsTitle")} />
        </WorkspacePanel>

        <WorkspacePanel title={t("companyProfiles")} subtitle={t("companyProfilesSub")}>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {props.sections.companyProfiles.map((row) => (
              <p key={row.companyId}>
                <span className="font-medium">{row.companyName}</span>
                <span className="text-slate-500">
                  {" "}
                  {t("profileRow", { score: row.readinessScore ?? "—", remediation: row.remediationOpen, social: row.socialFlagged })}
                </span>
              </p>
            ))}
          </div>
        </WorkspacePanel>
      </section>
    </>
  );
}

function ComplianceLoadingFallback() {
  const t = useTranslations("complianceAdmin");
  return <p className="text-sm text-slate-500">{t("loadingFilters")}</p>;
}

export function AdminComplianceModuleViews(props: Props) {
  return (
    <Suspense fallback={<ComplianceLoadingFallback />}>
      <AdminComplianceModuleViewsInner {...props} />
    </Suspense>
  );
}
