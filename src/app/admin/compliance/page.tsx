import Link from "next/link";
import { AdminComplianceQueue } from "@/components/AdminComplianceQueue";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadAdminComplianceCenter } from "@/lib/compliance/load-admin-compliance";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const data = await loadAdminComplianceCenter();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <PageHeader
        eyebrow="Risk & compliance"
        title="Compliance & risk review"
        description="Internal institutional controls for readiness risk, outreach compliance, messaging flags, and platform activity. Not legal advice."
        metadata={
          data.scanCreated > 0
            ? `${data.scanCreated} event(s) recorded this session · staff-only internal notes`
            : "Staff-only internal notes · audit trail in compliance_events"
        }
      />

      <MetricRow title="Review queue indicators" subtitle="Open and under-review counts">
        <MetricCard label="Open events" value={String(data.metrics.openEvents)} detail="Requires staff review" accent="indigo" />
        <MetricCard label="Critical" value={String(data.metrics.criticalEvents)} detail="Open or under review" accent="violet" />
        <MetricCard label="High severity" value={String(data.metrics.highEvents)} detail="Open or under review" accent="blue" />
        <MetricCard label="Under review" value={String(data.metrics.underReview)} detail="Actively being reviewed" accent="slate" />
      </MetricRow>

      <section className="mt-8">
        <WorkspacePanel title="Compliance review queue" subtitle="Open events — internal notes are staff-only">
          <AdminComplianceQueue events={data.openQueue} title="Open queue" />
        </WorkspacePanel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Founder readiness risk" subtitle="Low readiness scores (snapshot)">
          {data.sections.founderReadinessRisk.length === 0 ? (
            <p className="text-sm text-slate-500">No low-readiness companies flagged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.sections.founderReadinessRisk.map((row) => (
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
          {data.sections.investorApprovalReview.length === 0 ? (
            <p className="text-sm text-slate-500">No investors awaiting review.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.sections.investorApprovalReview.map((row) => (
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
            { label: "Private contacts", value: String(data.outreach.privateContactCount) },
            { label: "Queued messages", value: String(data.outreach.queuedMessageCount) },
            { label: "Draft campaigns", value: String(data.outreach.draftCampaignCount) },
            { label: "Flagged social (DB)", value: String(data.outreach.socialDraftFlaggedCount) },
            { label: "Daily limit", value: "25 (platform cap)" },
          ]}
        />

        <WorkspacePanel title="Social draft compliance" subtitle="Flagged drafts in centralized queue">
          <AdminComplianceQueue events={data.sections.socialCompliance} title="Social flags" />
        </WorkspacePanel>

        <WorkspacePanel title="Messaging risk flags" subtitle="Deterministic keyword rules">
          <AdminComplianceQueue events={data.sections.messagingFlags} title="Messaging" />
        </WorkspacePanel>

        <WorkspacePanel title="Platform activity alerts" subtitle="Onboarding, trial, high-risk companies">
          <AdminComplianceQueue events={data.sections.platformAlerts} title="Platform alerts" />
        </WorkspacePanel>

        <AnalyticsBreakdownPanel
          title="Subscription / payment risk"
          subtitle="Operational signals only — no payment processing"
          rows={[
            { label: "Pending upgrade requests", value: String(data.sections.subscriptionRisk.pendingUpgrades) },
            { label: "Expired founder trials", value: String(data.sections.subscriptionRisk.expiredTrials) },
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
                {data.sections.highRiskCompanies.map((row) => (
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
          <AdminComplianceQueue events={data.sections.outreachCompliance.events} title="Outreach events" />
        </WorkspacePanel>

        <WorkspacePanel title="Company compliance profiles" subtitle="Per-company snapshot (no founder PII beyond name)">
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {data.sections.companyProfiles.map((row) => (
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
    </AppShell>
  );
}
