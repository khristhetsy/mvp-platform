import Link from "next/link";
import { useTranslations } from "next-intl";
import { InvestorDealActions } from "@/components/InvestorDealActions";
import { InvestableReadinessPanel } from "@/components/investor/InvestableReadinessPanel";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { InvestorCompanyReportSnapshot } from "@/lib/investor/load-company-report";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

export function InvestorCompanyReportView({
  report,
  viewerRole,
  isOwnCompany,
}: Readonly<{
  report: InvestorCompanyReportSnapshot;
  viewerRole: "investor" | null;
  isOwnCompany: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  const { listing } = report;
  const pledgeLabel = formatPledgeTotal(
    report.investorSignals.indicativePledgeTotal,
    report.investorSignals.pledgeCurrency,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Investor company report
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{listing.companyName}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {[report.overview.industry, report.overview.stage, report.overview.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {report.overview.shortSummary ? (
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{report.overview.shortSummary}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          Published marketplace listing · Not a securities offering or legal opinion
        </p>
      </section>

      {/* Investable Readiness Score — investor-only */}
      {report.investableReadiness.totalScore !== null && report.investableReadiness.factorScores ? (
        <InvestableReadinessPanel
          companyName={listing.companyName}
          totalScore={report.investableReadiness.totalScore}
          factorScores={report.investableReadiness.factorScores as Record<FactorKey, FactorScore>}
          effectiveScore={report.investableReadiness.effectiveScore}
          isOverridden={report.investableReadiness.isOverridden}
          scoredAt={report.investableReadiness.scoredAt}
          scoreHistory={report.investableReadiness.scoreHistory}
          platformAvg={report.investableReadiness.platformAvg}
          percentile={report.investableReadiness.percentile}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkspacePanel title={t("company_overview")} subtitle={t("public_marketplace_profile")}>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Industry</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.overview.industry ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Stage</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.overview.stage ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Headquarters</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.overview.location ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Listed</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.overview.publishedAt
                  ? new Date(report.overview.publishedAt).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </WorkspacePanel>

        <WorkspacePanel title={t("capital_raise_overview")} subtitle={t("from_published_campaign_fields")}>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Funding target</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.capitalRaise.fundingTarget ?? "TBD"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Minimum investment</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.capitalRaise.minimumInvestment ?? "TBD"}
              </dd>
            </div>
          </dl>
          {report.capitalRaise.useOfFunds ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">{report.capitalRaise.useOfFunds}</p>
          ) : null}
        </WorkspacePanel>

        <WorkspacePanel title={t("readiness_summary")} subtitle={t("scores_and_onboarding_progress")}>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Latest readiness score</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.readiness.readinessScore ?? "—"}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Onboarding progress</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.readiness.onboardingProgressPercent}%
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Onboarding completed</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.readiness.onboardingCompletedAt
                  ? new Date(report.readiness.onboardingCompletedAt).toLocaleDateString()
                  : "In progress"}
              </dd>
            </div>
            {report.readiness.currentMilestone ? (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <dt className="text-slate-500">Current milestone</dt>
                <dd className="min-w-0 text-right font-medium text-slate-900">{report.readiness.currentMilestone}</dd>
              </div>
            ) : null}
          </dl>
          {report.readiness.readinessHistory.length > 1 ? (
            <p className="mt-3 text-xs text-slate-500">
              Recent scores:{" "}
              {report.readiness.readinessHistory
                .map((row) => row.score ?? "—")
                .slice(0, 5)
                .join(" → ")}
            </p>
          ) : null}
        </WorkspacePanel>

        <WorkspacePanel title={t("document_data_room_summary")} subtitle={t("availability_only_no_private_file_paths")}>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Documents uploaded</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.documents.uploadedCount}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Pitch deck</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.documents.pitchDeckPresent ? "Available" : "Not uploaded"}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Admin-approved documents</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.documents.approvedCount}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1 text-xs text-slate-600">
            {report.documents.checklist.map((item) => (
              <li key={item.code}>
                {item.label}:{" "}
                <span className="font-medium text-slate-800">
                  {item.status === "missing" ? "Missing" : item.status === "needs_review" ? "Needs review" : "Uploaded"}
                </span>
              </li>
            ))}
          </ul>
        </WorkspacePanel>

        <WorkspacePanel
          title={t("investor_activity_signals")}
          subtitle={t("platform_wide_aggregates_no_private_investor")}
        >
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Expressed interests</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.investorSignals.expressedInterestCount}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Indicative pledge total</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{pledgeLabel}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Participating investors</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.investorSignals.investorCount}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Intro requests</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.investorSignals.introRequestCount}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Message threads</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.investorSignals.messageThreadCount}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Scheduled meetings</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">
                {report.investorSignals.meetingsScheduledCount}
              </dd>
            </div>
          </dl>
        </WorkspacePanel>

        <WorkspacePanel title={t("learning_progression")} subtitle={t("founder_learning_modules_on_platform")}>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Modules completed</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.learning.modulesCompleted}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">In progress</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{report.learning.modulesInProgress}</dd>
            </div>
          </dl>
        </WorkspacePanel>
      </div>

      <WorkspacePanel title={t("diligence_summary")} subtitle={t("published_readiness_narrative_not_legal_advi")}>
        <p className="text-sm leading-6 text-slate-700">
          {report.diligenceSummary.executiveSummary ?? "No diligence summary published yet."}
        </p>
        {report.diligenceSummary.generatedAt ? (
          <p className="mt-2 text-xs text-slate-500">
            Last updated {new Date(report.diligenceSummary.generatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title={t("risk_factors_missing_items")} subtitle={t("high_level_gaps_from_readiness_checklist")}>
        {report.riskFactors.missingItems.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-slate-700">
            {report.riskFactors.missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">{t("no_missing_required_items_flagged_in_the_lat")}</p>
        )}
        {report.riskFactors.riskFlagCount > 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            {report.riskFactors.riskFlagCount} diligence risk flag(s) noted in the latest report.
          </p>
        ) : null}
        {report.riskFactors.publicRiskDisclosures ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">{report.riskFactors.publicRiskDisclosures}</p>
        ) : null}
      </WorkspacePanel>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.42fr]">
        <WorkspacePanel title={t("next_steps")} subtitle={t("engage_with_the_founder_on_icapos")}>
          <p className="text-sm text-slate-600">
            Use the actions panel to express indicative interest, request an introduction, or open a message thread
            when messaging is enabled for this listing.
          </p>
          <Link
            href={`/deals/${report.ctas.dealSlug}`}
            className="mt-4 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-600"
          >
            View full marketplace listing
          </Link>
        </WorkspacePanel>
        <InvestorDealActions
          companyId={listing.id}
          companySlug={report.ctas.dealSlug}
          companyName={listing.companyName}
          viewerRole={viewerRole}
          isOwnCompany={isOwnCompany}
          pitchDeckDocumentId={report.ctas.pitchDeckDocumentId}
          signInNextPath={`/investor/opportunities/${listing.id}/report`}
        />
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Internal admin notes, compliance events, private founder contacts, and private remediation tasks are not
        included in this investor-facing report. This is informational diligence only — not investment advice or a
        securities offering document.
      </p>
    </div>
  );
}
