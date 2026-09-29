import { useTranslations } from "next-intl";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { OUTREACH_GATE } from "@/lib/crr/weight-sets";
import {
  buildCompanyFilteredHref,
  type AdminCompanyWorkspaceData,
} from "@/lib/admin/company-workspace-types";

function reviewStatusToBadge(status: string | null): "neutral" | "info" | "success" | "warning" | "danger" | "pending" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
    case "submitted":
      return "pending";
    case "changes_requested":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function CompanyWorkspaceHeader({
  data,
  showMetrics = true,
}: Readonly<{ data: AdminCompanyWorkspaceData; showMetrics?: boolean }>) {
  const t = useTranslations("adminCmp");
  const { company, founder, readiness } = data;
  const companyId = company.id;
  const isLive = company.is_published && company.marketplace_visible;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("company_workspace")}
        title={company.company_name}
        description={company.industry ? `${company.industry} · Operational command surface` : "Operational command surface"}
        metadata={[
          `Company ID ${companyId.slice(0, 8)}…`,
          company.capital_ready_at
            ? `Capital Ready since ${new Date(company.capital_ready_at).toLocaleDateString()}`
            : null,
          `Last loaded ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
        ]
          .filter(Boolean)
          .join(" · ")}
        queueIndicator={
          data.queueItems.length > 0 ? (
            <StatusBadge label={`${data.queueItems.length} queue item${data.queueItems.length === 1 ? "" : "s"}`} status="warning" dot />
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={`Review: ${company.review_status ?? "unknown"}`}
          status={reviewStatusToBadge(company.review_status)}
          dot
        />
        <StatusBadge
          label={isLive ? "Published on marketplace" : "Not published"}
          status={isLive ? "success" : "neutral"}
        />
        {readiness.latestScore != null ? (
          <StatusBadge label={`Readiness ${readiness.latestScore}`} status="info" />
        ) : null}
        <StatusBadge label={`Onboarding ${readiness.onboardingPercent}%`} status="neutral" />
      </div>

      {founder ? (
        <p className="text-sm text-slate-600">
          Founder contact: {founder.full_name ?? "Unknown"} · {founder.email ?? "—"}
        </p>
      ) : null}

      {showMetrics ? <CompanyWorkspaceMetrics data={data} /> : null}
    </div>
  );
}

export function CompanyWorkspaceMetrics({ data }: Readonly<{ data: AdminCompanyWorkspaceData }>) {
  const t = useTranslations("adminCmp");
  const { company, readiness } = data;
  const companyId = company.id;
  const crrScore = data.investable ? (data.investable.effectiveScore ?? data.investable.totalScore) : null;

  // In-workspace cards deep-link to a tab via the URL hash; the workspace listens
  // for hashchange and switches tabs (no reload). External cards keep their href.
  const drill = (tabKey: string, card: React.ReactElement) => (
    <a href={`#${tabKey}`} className="block cursor-pointer">{card}</a>
  );

  return (
    <MetricGrid>
      {drill(
        "qualify",
        <MetricCard
          audience="admin"
          label={t("readiness_score")}
          value={readiness.latestScore != null ? String(readiness.latestScore) : "—"}
          detail={readiness.milestoneLabel}
          accent="indigo"
          unit={`onboarding ${readiness.onboardingPercent}%`}
          ring={{ percent: readiness.latestScore, center: readiness.latestScore != null ? String(readiness.latestScore) : "—" }}
          flag={
            readiness.latestScore == null
              ? { text: "No diligence report has been run for this company.", tone: "warn" }
              : null
          }
        />,
      )}
      {drill(
        "deploy",
        <MetricCard
          audience="admin"
          label="Capital Readiness Rating"
          value={data.investable ? String(data.investable.effectiveScore ?? data.investable.totalScore) : "—"}
          detail={
            data.investable
              ? `${data.investable.isOverridden ? "Adjusted · " : ""}${crrScore != null && crrScore < OUTREACH_GATE ? `${OUTREACH_GATE - crrScore} short of the ${OUTREACH_GATE} gate` : "outreach gate cleared"}`
              : "Not yet scored"
          }
          accent="blue"
          status={data.investable ? "info" : "neutral"}
          unit={`gate ${OUTREACH_GATE}`}
          // The gate tick is the point of this ring: it turns the score into a distance.
          ring={{ percent: crrScore, center: crrScore != null ? String(crrScore) : "—", sublabel: "/100", gate: OUTREACH_GATE }}
          flag={
            crrScore == null
              ? { text: `The engine has never run — outreach stays locked until it scores ${OUTREACH_GATE}.`, tone: "warn" }
              : crrScore < OUTREACH_GATE
                ? { text: `${OUTREACH_GATE - crrScore} points to unlock investor outreach.`, tone: "warn" }
                : { text: "Outreach gate cleared.", tone: "good" }
          }
          detailPanel={{
            note: data.investable?.isOverridden
              ? "This score is an admin override, not the engine's own figure."
              : undefined,
            breakdown: [
              { label: "Engine score", value: String(data.investable?.totalScore ?? "—") },
              { label: "Effective score", value: String(crrScore ?? "—") },
              { label: "Outreach gate", value: String(OUTREACH_GATE) },
              {
                label: "Distance to gate",
                value: crrScore == null ? "—" : crrScore >= OUTREACH_GATE ? "cleared" : `${OUTREACH_GATE - crrScore}`,
                tone: crrScore != null && crrScore >= OUTREACH_GATE ? "good" : "warn",
              },
            ],
            href: `/admin/companies/${companyId}#qualify`,
            hrefLabel: "Open Preparation",
          }}
        />,
      )}
      {drill(
        "qualify",
        <MetricCard
          audience="admin"
          label={t("open_remediation")}
          value={String(readiness.remediation.active)}
          detail={`${readiness.remediation.completed} closed of ${readiness.remediation.total} · ${readiness.remediation.highPriorityOpen} high priority`}
          accent="violet"
          status={readiness.remediation.active > 0 ? "warning" : "success"}
          unit={`${readiness.remediation.completed} closed of ${readiness.remediation.total}`}
          flag={
            readiness.remediation.highPriorityOpen > 0
              ? { text: `${readiness.remediation.highPriorityOpen} high priority still open.`, tone: "bad" }
              : readiness.remediation.active > 0
                ? { text: "None are high priority.", tone: "good" }
                : null
          }
          detailPanel={{
            breakdown: [
              { label: "Open", value: String(readiness.remediation.open), tone: readiness.remediation.open > 0 ? "warn" : undefined },
              { label: "In progress", value: String(readiness.remediation.inProgress) },
              { label: "Completed", value: String(readiness.remediation.completed), tone: "good" },
              { label: "Dismissed", value: String(readiness.remediation.dismissed) },
              { label: "High priority open", value: String(readiness.remediation.highPriorityOpen), tone: readiness.remediation.highPriorityOpen > 0 ? "bad" : "good" },
            ],
            href: `/admin/companies/${companyId}#qualify`,
            hrefLabel: "Open readiness",
          }}
          // A bare "8" has no scale. The ring fills as tasks close.
          ring={{
            percent: readiness.remediation.total > 0 ? Math.round((readiness.remediation.completed / readiness.remediation.total) * 100) : null,
            center: String(readiness.remediation.active),
            sublabel: readiness.remediation.total > 0 ? `of ${readiness.remediation.total}` : undefined,
            pending: readiness.remediation.total === 0,
            color: readiness.remediation.active > 0 ? "#D97706" : "#059669",
          }}
        />,
      )}
      <MetricCard
          audience="admin"
        label={t("investor_interests_2")}
        value={String(data.investorActivity.interests)}
        detail={`${data.investorActivity.introRequests} intro requests`}
        accent="blue"
        href={buildCompanyFilteredHref("/admin/crm", companyId)}
        unit={`${data.investorActivity.introRequests} intro requests`}
        flag={
          data.investorActivity.interests === 0
            ? { text: "No investor has seen this company yet.", tone: "warn" }
            : null
        }
        // No ceiling to measure against: a dashed ring beats an invented arc.
        ring={{
          percent: null,
          center: String(data.investorActivity.interests),
          pending: data.investorActivity.interests === 0,
          color: data.investorActivity.interests > 0 ? "#059669" : undefined,
        }}
      />
      <MetricCard
          audience="admin"
        label={t("open_compliance")}
        value={String(data.compliance.openCount)}
        detail={`${data.compliance.totalCount - data.compliance.openCount} resolved of ${data.compliance.totalCount} · ${data.compliance.criticalCount} critical`}
        accent="slate"
        unit={`${data.compliance.totalCount - data.compliance.openCount} resolved of ${data.compliance.totalCount}`}
        flag={
          data.compliance.criticalCount > 0
            ? { text: `${data.compliance.criticalCount} critical.`, tone: "bad" }
            : data.compliance.openCount === 0
              ? { text: "Nothing outstanding.", tone: "good" }
              : null
        }
        detailPanel={{
          note: data.compliance.nextAction ?? undefined,
          breakdown: [
            { label: "Open", value: String(data.compliance.openCount), tone: data.compliance.openCount > 0 ? "warn" : "good" },
            { label: "Critical", value: String(data.compliance.criticalCount), tone: data.compliance.criticalCount > 0 ? "bad" : "good" },
            { label: "High", value: String(data.compliance.highCount) },
            { label: "Resolved", value: String(data.compliance.totalCount - data.compliance.openCount), tone: "good" },
            { label: "Raised all time", value: String(data.compliance.totalCount) },
          ],
          hrefLabel: "Open compliance",
        }}
        ring={{
          percent: data.compliance.totalCount > 0
            ? Math.round(((data.compliance.totalCount - data.compliance.openCount) / data.compliance.totalCount) * 100)
            : null,
          center: String(data.compliance.openCount),
          sublabel: data.compliance.totalCount > 0 ? `of ${data.compliance.totalCount}` : undefined,
          pending: data.compliance.totalCount === 0,
          color: data.compliance.criticalCount > 0 ? "#DC2626" : data.compliance.openCount > 0 ? "#D97706" : "#059669",
        }}
        status={data.compliance.criticalCount > 0 ? "danger" : data.compliance.openCount > 0 ? "warning" : "success"}
        href={buildCompanyFilteredHref("/admin/compliance", companyId)}
      />
    </MetricGrid>
  );
}
