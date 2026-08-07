import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { track } from "@/lib/analytics/posthog";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listRecentDiligenceReports } from "@/lib/data/founder-readiness";
import { ReportExportButtons } from "@/components/founder/ReportExportButtons";
import { GenerateMyReportButton } from "@/components/founder/GenerateMyReportButton";
import { DiligenceReportDocument } from "@/components/founder/DiligenceReportDocument";
import { ReportCompareToggle } from "@/components/founder/ReportCompareToggle";
import type { DiligenceReportRow } from "@/components/founder/DiligenceReportCompare";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function splitLines(value: string | null | undefined) {
  if (!value?.trim()) return [];
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default async function DiligenceReportPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const { data: recentReports } = company
    ? await listRecentDiligenceReports(supabase, company.id, 2)
    : { data: null };
  const reportVersions = (recentReports ?? []) as unknown as DiligenceReportRow[];
  const diligenceReport = recentReports?.[0] ?? null;
  const previousReport = reportVersions.length > 1 ? reportVersions[1] : null;

  const companyName = company?.company_name ?? "Your company";

  if (diligenceReport) {
    track("report_viewed", { founderId: profile.id, companyId: company?.id });
  }

  const riskFlags = diligenceReport?.risk_flags ?? [];
  const missingDocuments = diligenceReport?.missing_documents ?? [];
  const recommendations = splitLines(diligenceReport?.recommendations);

  return (
    <FounderAppShell>
      <FounderFeatureGate featureKey="readiness">
        {!diligenceReport ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t("diligence_report")}</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">{t("no_diligence_report_generated_yet")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {company
                ? "Generate a report from the documents you've uploaded — you'll get an executive summary, risk flags, missing documents, and recommended next steps. Upload more documents first for a sharper result."
                : "Complete company onboarding first, then request diligence review."}
            </p>
            {company ? (
              <div className="mt-6 flex justify-center">
                <GenerateMyReportButton />
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/founder/readiness" className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy)]">
                View readiness checklist
              </Link>
              <Link href="/founder/documents" className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy)]">
                Upload documents
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-6 md:flex-row">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t("diligence_report")}</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{companyName}</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Investor-style diligence generated from your uploaded documents. Regenerate after adding materials
                    for a sharper result.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Generated {new Date(diligenceReport.created_at).toLocaleString("en-US")}
                  </p>
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    <ReportExportButtons />
                    <GenerateMyReportButton variant="secondary" label="Regenerate" />
                    {previousReport ? (
                      <ReportCompareToggle
                        current={diligenceReport as unknown as DiligenceReportRow}
                        previous={previousReport}
                      />
                    ) : null}
                  </div>
                </div>
                {typeof diligenceReport.readiness_score === "number" ? (
                  <div className="rounded-xl border border-[var(--navy)] bg-[var(--navy)] p-5 text-white shadow-[var(--shadow-panel)]">
                    <p className="text-sm text-slate-300">{t("investor_readiness_score")}</p>
                    <p className="mt-2 text-4xl font-semibold tabular-nums">{diligenceReport.readiness_score}</p>
                    <p className="mt-2 text-sm text-slate-300">{t("from_stored_diligence_report")}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <DiligenceReportDocument
              companyName={companyName}
              generatedAt={new Date(diligenceReport.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              executiveSummary={diligenceReport.executive_summary}
              businessOverview={diligenceReport.business_overview}
              financialReview={diligenceReport.financial_review}
              marketReview={diligenceReport.market_review}
              legalReview={diligenceReport.legal_review}
              teamReview={diligenceReport.team_review}
              missingDocuments={missingDocuments as string[]}
              recommendations={recommendations}
              riskFlags={riskFlags as string[]}
            />
          </>
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
