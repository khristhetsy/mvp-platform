import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { listCompanyDocuments } from "@/lib/data/documents";
import {
  buildDocumentChecklist,
  buildProfileCompletion,
  buildRecommendedActions,
  computeReadinessScore,
  formatReviewStatus,
  getLatestAdminReview,
  getLatestDiligenceReport,
} from "@/lib/data/founder-readiness";
import { FounderRemediationActionPlan } from "@/components/FounderRemediationActionPlan";
import { FounderReadinessDonutCards } from "@/components/founder/FounderReadinessDonutCards";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { computeReadinessBenchmark } from "@/lib/data/readiness-benchmark";
import { ReadinessBenchmarkBanner } from "@/components/founder/ReadinessBenchmarkBanner";

export const dynamic = "force-dynamic";

export default async function FounderReadinessPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const checklist = buildDocumentChecklist(documents);
  const profileCompletion = buildProfileCompletion(company);
  const uploadedCount = checklist.filter((item) => item.status !== "missing").length;
  const missingDocuments = checklist.filter((item) => item.status === "missing");

  const [{ data: diligenceReport }, { data: adminReview }] = company
    ? await Promise.all([
        getLatestDiligenceReport(supabase, company.id),
        getLatestAdminReview(supabase, company.id),
      ])
    : [{ data: null }, { data: null }];

  const uploadedTypeCodes = documents.flatMap((document) => (document.document_type ? [document.document_type] : []));
  const computedScore = computeReadinessScore(uploadedTypeCodes);
  const readinessScore = diligenceReport?.readiness_score ?? computedScore;
  const reviewStatus = company?.review_status ?? adminReview?.status ?? company?.status ?? null;
  const reviewNotes =
    adminReview?.feedback ?? adminReview?.requested_changes ?? adminReview?.notes ?? null;

  const recommendedActions = buildRecommendedActions({
    checklist,
    profileItems: profileCompletion.items,
    reviewStatus: reviewStatus ? String(reviewStatus) : null,
    reviewFeedback: reviewNotes,
    reportRecommendations: diligenceReport?.recommendations ?? null,
    isPublished: Boolean(company?.is_published),
  });

  const companyName = company?.company_name ?? "Your company";
  const remediation = await loadFounderRemediationPlan(profile);
  const benchmark = company ? await computeReadinessBenchmark(company.id, company.revenue_stage ?? null) : null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="readiness">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Readiness"
            title="Checklist"
            description="Track profile completion, document progress, diligence review status, and recommended next actions."
          />

          {!company ? (
            <WorkspacePanel title="Company profile required" subtitle="Link a company to track readiness">
              <p className="text-sm text-slate-600">Create your company profile to start tracking readiness.</p>
              <Link
                href="/founder/onboarding"
                className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Create company profile
              </Link>
            </WorkspacePanel>
          ) : (
            <>
              <section>
                <FounderReadinessDonutCards
                  readinessScore={readinessScore}
                  readinessDetail={
                    diligenceReport?.readiness_score != null
                      ? "From latest AI diligence report"
                      : "Estimated from document checklist"
                  }
                  profilePercent={profileCompletion.percent}
                  profileItems={profileCompletion.items}
                  uploadedCount={uploadedCount}
                  checklistTotal={checklist.length}
                  checklist={checklist}
                  missingCount={missingDocuments.length}
                  reviewStatusFormatted={formatReviewStatus(reviewStatus ? String(reviewStatus) : null)}
                  isPublished={Boolean(company.is_published)}
                  reviewFeedback={reviewNotes}
                />
              </section>

              {benchmark && (
                <section className="mt-6">
                  <ReadinessBenchmarkBanner benchmark={benchmark} />
                </section>
              )}

              <section className="mt-6">
                <FounderRemediationActionPlan
                  tasks={remediation.tasks}
                  summary={remediation.summary}
                  learningLinks={remediation.learningLinks}
                  title="Readiness remediation action plan"
                />
              </section>

              <section className="mt-6">
                <WorkspacePanel title="Recommended next actions" subtitle="Prioritized steps to improve readiness">
                  {recommendedActions.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No immediate actions. Your readiness materials look complete.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {recommendedActions.map((action) => (
                        <div
                          key={action}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800"
                        >
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </WorkspacePanel>
              </section>
            </>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
