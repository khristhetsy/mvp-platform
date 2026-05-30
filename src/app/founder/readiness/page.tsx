import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
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
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function checklistStatusLabel(status: "missing" | "uploaded" | "needs_review") {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "needs_review":
      return "Needs review";
    default:
      return "Missing";
  }
}

function checklistStatusClass(status: "missing" | "uploaded" | "needs_review") {
  switch (status) {
    case "uploaded":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "needs_review":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-100";
  }
}

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

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="readiness">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Founder Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Readiness</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track profile completion, document checklist progress, diligence review status, and recommended next actions.
        </p>
      </div>

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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Readiness Score"
              value={`${readinessScore}/100`}
              detail={
                diligenceReport?.readiness_score != null
                  ? "From latest AI diligence report"
                  : "Estimated from document checklist"
              }
              accent="indigo"
            />
            <MetricCard
              label="Profile Completion"
              value={`${profileCompletion.percent}%`}
              detail={`${profileCompletion.items.filter((item) => item.complete).length} of ${profileCompletion.items.length} fields complete`}
              accent="violet"
            />
            <MetricCard
              label="Documents Uploaded"
              value={`${uploadedCount}/${checklist.length}`}
              detail={`${missingDocuments.length} key ${missingDocuments.length === 1 ? "document" : "documents"} missing`}
              accent="blue"
            />
            <MetricCard
              label="Diligence Review"
              value={formatReviewStatus(reviewStatus ? String(reviewStatus) : null)}
              detail={company.is_published ? "Published to marketplace" : "Admin review and publication pending"}
              accent="slate"
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Company profile checklist" subtitle="Completion status for core company fields">
              <div className="grid gap-3">
                {profileCompletion.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.complete ? "bg-emerald-50 text-emerald-800" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.complete ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/founder/settings"
                className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900"
              >
                Update company settings
              </Link>
            </WorkspacePanel>

            <WorkspacePanel title="Diligence & review status" subtitle="Admin review and AI diligence outputs">
              <div className="grid gap-4">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-slate-600">Review status</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {formatReviewStatus(reviewStatus ? String(reviewStatus) : null)}
                  </p>
                  {reviewNotes ? <p className="mt-2 text-sm leading-6 text-slate-600">{reviewNotes}</p> : null}
                </div>
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
                  <p className="text-sm font-medium text-indigo-700">AI diligence report</p>
                  {diligenceReport ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        Score {diligenceReport.readiness_score ?? readinessScore}/100
                      </p>
                      {diligenceReport.executive_summary ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{diligenceReport.executive_summary}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">No AI diligence report generated yet.</p>
                  )}
                </div>
              </div>
              <Link
                href="/founder/report"
                className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800"
              >
                View diligence report
              </Link>
            </WorkspacePanel>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <WorkspacePanel
              title="Document checklist"
              subtitle="Required diligence documents and upload status"
              action={
                <Link href="/founder/documents" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                  Manage uploads
                </Link>
              }
            >
              <div className="divide-y divide-slate-100">
                {checklist.map((item) => (
                  <div key={item.code} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      {item.fileName ? <p className="mt-0.5 text-xs text-slate-500">{item.fileName}</p> : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${checklistStatusClass(item.status)}`}
                    >
                      {checklistStatusLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            </WorkspacePanel>

            <WorkspacePanel title="Missing key documents" subtitle="Items still needed for readiness">
              {missingDocuments.length === 0 ? (
                <p className="text-sm text-emerald-700">All key documents are uploaded.</p>
              ) : (
                <ul className="grid gap-2 text-sm text-slate-700">
                  {missingDocuments.map((item) => (
                    <li key={item.code} className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(diligenceReport?.missing_documents) &&
              (diligenceReport.missing_documents as string[]).length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">AI report flagged missing items</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {(diligenceReport.missing_documents as string[]).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </WorkspacePanel>
          </section>

          <section className="mt-6">
            <WorkspacePanel title="Recommended next actions" subtitle="Prioritized steps to improve readiness">
              {recommendedActions.length === 0 ? (
                <p className="text-sm text-slate-600">No immediate actions. Your readiness materials look complete.</p>
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
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
