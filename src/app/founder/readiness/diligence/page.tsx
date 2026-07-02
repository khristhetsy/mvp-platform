import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import {
  buildDocumentChecklist,
  buildProfileCompletion,
  computeReadinessScore,
  formatReviewStatus,
  getLatestAdminReview,
  getLatestDiligenceReport,
} from "@/lib/data/founder-readiness";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderReadinessDiligencePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const [{ data: diligenceReport }, { data: adminReview }] = company
    ? await Promise.all([
        getLatestDiligenceReport(supabase, company.id),
        getLatestAdminReview(supabase, company.id),
      ])
    : [{ data: null }, { data: null }];

  const reviewStatus = company?.review_status ?? adminReview?.status ?? company?.status ?? null;
  const reviewNotes =
    adminReview?.feedback ?? adminReview?.requested_changes ?? adminReview?.notes ?? null;

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const uploadedTypeCodes = documents.flatMap((d) => (d.document_type ? [d.document_type] : []));
  const computedScore = computeReadinessScore(uploadedTypeCodes);
  const readinessScore = diligenceReport?.readiness_score ?? computedScore;

  const profileCompletion = buildProfileCompletion(company);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="readiness">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("readiness")}
            title={t("diligence_review")}
            description={t("admin_review_status_ai_diligence_report_and_co")}
          />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("complete_setup_to_view_review_status")}>
              <p className="text-sm text-slate-600">{t("create_your_company_profile_to_access_diligenc")}</p>
            </WorkspacePanel>
          ) : (
            <section className="grid gap-6 xl:grid-cols-2">
              <WorkspacePanel title={t("company_profile_checklist")} subtitle={t("completion_status_for_core_company_fields")}>
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

              <WorkspacePanel title={t("diligence_review_status")} subtitle={t("admin_review_and_ai_diligence_outputs")}>
                <div className="grid gap-4">
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-600">{t("review_status")}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {formatReviewStatus(reviewStatus ? String(reviewStatus) : null)}
                    </p>
                    {reviewNotes ? <p className="mt-2 text-sm leading-6 text-slate-600">{reviewNotes}</p> : null}
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
                    <p className="text-sm font-medium text-indigo-700">{t("ai_diligence_report")}</p>
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
                      <p className="mt-2 text-sm text-slate-600">{t("no_ai_diligence_report_generated_yet")}</p>
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
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
