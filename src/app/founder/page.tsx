import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { FounderOnboardingProgressCard } from "@/components/FounderOnboardingProgressCard";
import { FounderRemediationActionPlan } from "@/components/FounderRemediationActionPlan";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { FounderLearningPreviewCard } from "@/components/FounderLearningPreviewCard";
import { loadFounderLearningWorkspace } from "@/lib/learning/load-founder-learning";
import { DashboardInsightPanel } from "@/components/ui/DashboardInsightPanel";
import { FounderInvestorFitSignals } from "@/components/FounderInvestorFitSignals";
import { buildFounderInvestorFitSignals } from "@/lib/matching/investor-company-matching";
import { loadFounderCompanyMatchContext } from "@/lib/matching/load-matching-data";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { founderPipeline } from "@/lib/mock-data";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderDashboardPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();
  const { data: documents } = company ? await listCompanyDocuments(supabase, company.id) : { data: [] };
  const { data: diligenceReport } = company ? await getLatestDiligenceReport(supabase, company.id) : { data: null };
  const onboardingProgress = company
    ? computeFounderOnboardingProgress({
        company,
        documents: documents ?? [],
        diligenceReportExists: Boolean(diligenceReport),
        storedStepState: company.onboarding_step_state,
      })
    : null;
  const investorActivity = company ? await listFounderInvestorActivity(supabase, company.id) : null;
  const [remediation, learningAccess, investorFit] = await Promise.all([
    loadFounderRemediationPlan(profile),
    getFounderFeatureAccess("elearning"),
    company ? loadFounderCompanyMatchContext(company) : Promise.resolve(null),
  ]);
  const learning = learningAccess.allowed ? await loadFounderLearningWorkspace(profile) : null;

  let pledgeSummary = { totalPledged: 0, investorCount: 0, currency: "USD" };
  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
  }

  const companyName = company?.company_name ?? "Your company";
  const pitchDeck = documents?.find((document) => document.document_type === "PITCH_DECK");
  const documentStatus = pitchDeck ? "Pitch deck uploaded" : founderPipeline.documentStatus;
  const investorActivityTotal =
    (investorActivity?.interests.length ?? 0) +
    (investorActivity?.introRequests.length ?? 0) +
    (investorActivity?.savedDeals.length ?? 0);
  const raiseProgress = company?.is_published ? "Published" : founderPipeline.campaignStatus;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="dashboard">
      <PageHeader
        eyebrow="Founder terminal"
        title={companyName}
        description="Readiness, capital raise, investor engagement, and marketplace publication."
        actions={
          <>
            <Link
              href="/founder/settings"
              className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium"
            >
              Company settings
            </Link>
            <Link
              href="/founder/onboarding"
              className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy)]"
            >
              Continue onboarding
            </Link>
          </>
        }
      />

      {onboardingProgress ? <FounderOnboardingProgressCard progress={onboardingProgress} /> : null}

      {remediation.tasks.length > 0 ? (
        <div className="mb-8">
          <FounderRemediationActionPlan
            tasks={remediation.tasks}
            summary={remediation.summary}
            learningLinks={remediation.learningLinks}
            compact
            title="Priority remediation tasks"
          />
        </div>
      ) : null}

      {investorFit ? (
        <div className="mb-8">
          <FounderInvestorFitSignals
            signals={buildFounderInvestorFitSignals({
              company: investorFit.companyProfile,
              approvedInvestorMatchCount: investorFit.approvedInvestorCount,
              strongMatchCount: investorFit.strongMatchCount,
            })}
          />
        </div>
      ) : null}

      {learning ? (
        <div className="mb-8">
          <FounderLearningPreviewCard
            overallPercent={learning.overallPercent}
            currentMilestone={learning.currentMilestone}
            nextMilestone={learning.nextMilestone}
            continueModules={learning.continueModules}
            recommendations={learning.recommendations}
          />
        </div>
      ) : null}

      <MetricRow title="Capital readiness" subtitle="Operational indicators — not investment advice">
        <MetricCard
          label="Readiness Score"
          value={`${founderPipeline.readinessScore}/100`}
          detail={founderPipeline.diligenceProgress}
          accent="indigo"
          trend="up"
          sparklineValues={[68, 71, 74, 76, 79, 82, founderPipeline.readinessScore]}
        />
        <MetricCard
          label="Raise Progress"
          value={raiseProgress}
          detail={company?.status ?? founderPipeline.profileStatus}
          accent="violet"
          sparklineValues={[1, 2, 2, 3, 3, 4, 4]}
        />
        <MetricCard
          label="Indicative Interest"
          value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
          detail={`From ${pledgeSummary.investorCount} ${pledgeSummary.investorCount === 1 ? "investor" : "investors"}`}
          accent="blue"
          sparklineValues={[0, 1, 1, 2, pledgeSummary.investorCount, pledgeSummary.investorCount, pledgeSummary.investorCount]}
        />
        <MetricCard
          label="Investor Activity"
          value={String(investorActivityTotal)}
          detail="Interest, intros, and saved deals"
          accent="slate"
          sparklineValues={[0, 1, 2, investorActivityTotal, investorActivityTotal, investorActivityTotal, investorActivityTotal]}
        />
      </MetricRow>

      <section className="mt-5">
        <DashboardInsightPanel title="Engagement trend" subtitle="Workspace activity snapshot" />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <WorkspacePanel title="Capital Raise Overview" subtitle="Non-binding marketplace interest">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--navy-muted)] p-4 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-[var(--navy)]">Total pledged</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-sm font-medium text-slate-600">Funding target</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {company?.funding_amount ? formatPledgeTotal(Number(company.funding_amount)) : "TBD"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Pledges are indicative and not legally committed investment.
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Investor Pipeline" subtitle="Read-only activity on your listing">
          {investorActivity ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Expressed interest", investorActivity.interests.length],
                ["Intro requests", investorActivity.introRequests.length],
                ["Saved deals", investorActivity.savedDeals.length],
              ].map(([title, count]) => (
                <div key={title as string} className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title as string}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{count as number}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Investor activity will appear once your company is linked.</p>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          title="Recent Activity"
          subtitle="Documents and data room status"
          action={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{documentStatus}</span>
          }
        >
          <div className="divide-y divide-slate-100">
            {(documents ?? []).length > 0 ? (
              documents?.slice(0, 5).map((document) => (
                <div key={document.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-slate-800">{document.file_name ?? document.document_type}</span>
                  <span className="rounded-full bg-[var(--navy-muted)] px-2.5 py-1 text-xs font-medium text-[var(--navy)]">
                    {document.status ?? "uploaded"}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-slate-600">No documents uploaded yet.</p>
            )}
          </div>
        </WorkspacePanel>
      </section>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
