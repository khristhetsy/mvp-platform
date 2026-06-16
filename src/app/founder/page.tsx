import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { FounderOnboardingProgressCard } from "@/components/FounderOnboardingProgressCard";
import { FounderRemediationActionPlan } from "@/components/FounderRemediationActionPlan";
import { computeReadinessScore, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { FounderLearningPreviewCard } from "@/components/FounderLearningPreviewCard";
import { loadFounderLearningWorkspace } from "@/lib/learning/load-founder-learning";
import { DashboardInsightPanel } from "@/components/ui/DashboardInsightPanel";
import { FounderInvestorFitSignals } from "@/components/FounderInvestorFitSignals";
import { buildFounderInvestorFitSignals } from "@/lib/matching/investor-company-matching";
import { loadFounderCompanyMatchContext } from "@/lib/matching/load-matching-data";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import { CapitalReadinessSection } from "@/components/founder/CapitalReadinessSection";
import { DashboardPipelinePanel } from "@/components/founder/DashboardPipelinePanel";
import { FounderProactiveInsights } from "@/components/founder/FounderProactiveInsights";
import { FounderWeeklyDigest } from "@/components/founder/FounderWeeklyDigest";

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
  const [remediation, learningAccess, investorFit, nextBestActions] = await Promise.all([
    loadFounderRemediationPlan(profile),
    getFounderFeatureAccess("elearning"),
    company ? loadFounderCompanyMatchContext(company) : Promise.resolve(null),
    loadAndMergeNextBestActions({ profile, supabase, options: { limit: 5, sync: true } }),
  ]);
  const learning = learningAccess.allowed ? await loadFounderLearningWorkspace(profile) : null;

  let pledgeSummary = { totalPledged: 0, investorCount: 0, currency: "USD" };
  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
  }

  // Proactive insights data
  const { data: activeRooms } = company
    ? await supabase
        .from("deal_rooms")
        .select("id, title, status, updated_at")
        .eq("company_id", company.id)
        .in("status", ["active", "pending"])
        .order("updated_at", { ascending: true })
        .limit(10)
    : { data: [] as Array<{ id: string; title: string; status: string; updated_at: string }> };

  const roomIds = (activeRooms ?? []).map((r) => r.id);
  const { count: unresolvedQCount } = roomIds.length > 0
    ? await supabase
        .from("deal_room_questions")
        .select("id", { count: "exact", head: true })
        .in("room_id", roomIds)
        .neq("status", "resolved")
    : { count: 0 };

  const companyName = company?.company_name ?? "Your company";
  const pitchDeck = documents?.find((d) => d.document_type === "PITCH_DECK");
  const documentStatus = pitchDeck ? "Pitch deck uploaded" : "No pitch deck uploaded";
  const uploadedTypeCodes = (documents ?? []).flatMap((d) =>
    d.document_type ? [d.document_type] : [],
  );
  const checklistReadinessScore = computeReadinessScore(uploadedTypeCodes);
  const readinessScore = diligenceReport?.readiness_score ?? checklistReadinessScore;
  const readinessDetail = diligenceReport
    ? "Latest stored diligence report"
    : "Estimate from required document checklist";
  const investorActivityTotal =
    (investorActivity?.interests.length ?? 0) +
    (investorActivity?.introRequests.length ?? 0) +
    (investorActivity?.savedDeals.length ?? 0);
  const raiseProgress = company?.is_published ? "Published" : "Not published";


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
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Link
                href="/founder/settings"
                className="cap-btn-primary inline-flex w-full justify-center rounded-lg px-4 py-2.5 text-sm font-medium sm:w-auto"
              >
                Company settings
              </Link>
              <Link
                href="/founder/onboarding"
                className="cap-btn-secondary inline-flex w-full justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[var(--navy)] sm:w-auto"
              >
                Continue onboarding
              </Link>
            </div>
          }
        />

        {onboardingProgress ? <FounderOnboardingProgressCard progress={onboardingProgress} /> : null}

        {/* 1. Capital readiness — FIRST */}
        <div className="mb-8">
          <CapitalReadinessSection
            readinessScore={readinessScore}
            readinessDetail={readinessDetail}
            raiseProgress={raiseProgress}
            companyStatus={company?.status ?? null}
            companyFundingAmount={company?.funding_amount ? Number(company.funding_amount) : null}
            pledgeSummary={pledgeSummary}
            investorActivityTotal={investorActivityTotal}
            investorActivity={investorActivity}
            documents={documents ?? []}
          />
        </div>

        {/* 2. Weekly raise digest */}
        <div className="mb-8">
          <FounderWeeklyDigest
            rooms={activeRooms ?? []}
            documents={documents ?? []}
            unresolvedQCount={unresolvedQCount ?? 0}
            readinessScore={readinessScore}
            strongMatchCount={investorFit?.strongMatchCount ?? 0}
            investorActivityTotal={investorActivityTotal}
            companyCreatedAt={company?.created_at ?? null}
            founderName={profile.full_name ?? profile.email ?? "Founder"}
          />
        </div>

        {/* 3. Proactive AI insights */}
        <div className="mb-8">
          <FounderProactiveInsights
            rooms={activeRooms ?? []}
            unresolvedQCount={unresolvedQCount ?? 0}
            readinessScore={readinessScore}
            strongMatchCount={investorFit?.strongMatchCount ?? 0}
          />
        </div>

        {/* 3. What to do next */}
        <div className="mb-8">
          <NextBestActionsPanel
            role="founder"
            initialActions={nextBestActions.actions}
            limit={5}
            viewAllHref="/founder/actions?tab=overdue&overdue=true"
          />
        </div>

        {/* 4. Priority remediation tasks */}
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

        {/* 5. Investor fit signals */}
        {investorFit ? (
          <div className="mb-8">
            <FounderInvestorFitSignals
              signals={buildFounderInvestorFitSignals({
                company: investorFit.companyProfile,
                approvedInvestorMatchCount: investorFit.approvedInvestorCount,
                strongMatchCount: investorFit.strongMatchCount,
              })}
              approvedCount={investorFit.approvedInvestorCount}
              strongCount={investorFit.strongMatchCount}
            />
          </div>
        ) : null}

        {/* 5. Institutional readiness learning */}
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

        {/* 6. Engagement trend */}
        <section className="mb-8">
          <DashboardInsightPanel
            title="Engagement trend"
            subtitle="Workspace activity snapshot — last 7 days"
            introRequests={investorActivity?.introRequests.length ?? 0}
          />
        </section>

        {/* 7. Capital Raise Overview + Investor Pipeline */}
        <section className="mb-8 grid gap-5 xl:grid-cols-2">
          <WorkspacePanel title="Capital raise overview" subtitle="Non-binding marketplace interest">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg px-4 py-3 ring-1 ring-[#EEEDFE]" style={{ background: "#EEEDFE" }}>
                <p className="text-xs font-medium" style={{ color: "#534AB7" }}>Total pledged</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold" style={{ color: "#3C3489" }}>
                  {formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "#534AB7" }}>
                  {pledgeSummary.investorCount} investor{pledgeSummary.investorCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-600">Funding target</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-950">
                  {company?.funding_amount ? formatPledgeTotal(Number(company.funding_amount)) : "TBD"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {raiseProgress}
                </p>
              </div>
            </div>
            {company?.funding_amount && Number(company.funding_amount) > 0 ? (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Raise progress</span>
                  <span className="text-[11px] font-semibold" style={{ color: "#534AB7" }}>
                    {Math.round(Math.min(100, (pledgeSummary.totalPledged / Number(company.funding_amount)) * 100))}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (pledgeSummary.totalPledged / Number(company.funding_amount)) * 100)}%`,
                      background: "#534AB7",
                    }}
                  />
                </div>
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Pledges are indicative and not legally committed investment.
            </p>
          </WorkspacePanel>

          {investorActivity ? (
            <DashboardPipelinePanel activity={investorActivity} />
          ) : (
            <WorkspacePanel title="Investor pipeline" subtitle="Read-only activity on your listing">
              <p className="text-sm text-slate-600">Investor activity will appear once your company is linked.</p>
            </WorkspacePanel>
          )}
        </section>

        {/* 8. Recent Activity */}
        <section className="mb-8">
          <WorkspacePanel
            title="Recent activity"
            subtitle="Documents and data room status"
            action={
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {documentStatus}
              </span>
            }
          >
            <div className="divide-y divide-slate-100">
              {(documents ?? []).length > 0 ? (
                documents?.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                      {doc.file_name ?? doc.document_type}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2.5 py-1 text-[10px] font-semibold ${
                        doc.status === "approved"
                          ? "bg-[#EAF3DE] text-[#3B6D11]"
                          : doc.status === "rejected"
                          ? "bg-[#FCEBEB] text-[#A32D2D]"
                          : "bg-[#EEEDFE] text-[#3C3489]"
                      }`}
                    >
                      {doc.status ?? "uploaded"}
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
