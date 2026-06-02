import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
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
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const { data: diligenceReport } = company
    ? await getLatestDiligenceReport(supabase, company.id)
    : { data: null };

  const companyName = company?.company_name ?? "Your company";
  const riskFlags = diligenceReport?.risk_flags ?? [];
  const missingDocuments = diligenceReport?.missing_documents ?? [];
  const recommendations = splitLines(diligenceReport?.recommendations);
  const sections = [
    { title: "Business overview", body: diligenceReport?.business_overview },
    { title: "Financial review", body: diligenceReport?.financial_review },
    { title: "Market review", body: diligenceReport?.market_review },
    { title: "Legal review", body: diligenceReport?.legal_review },
    { title: "Team review", body: diligenceReport?.team_review },
  ].filter((section) => section.body?.trim());

  return (
    <FounderAppShell>
      <FounderFeatureGate featureKey="readiness">
        {!diligenceReport ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Diligence report</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">No diligence report generated yet</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {company
                ? "When staff or AI generates a diligence report for your company, it will appear here with executive summary, risks, and recommendations."
                : "Complete company onboarding first, then request diligence review."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/founder/readiness" className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium">
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
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Diligence report</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{companyName}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    {diligenceReport.executive_summary ?? "Executive summary pending."}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Generated {new Date(diligenceReport.created_at).toLocaleString("en-US")}
                  </p>
                </div>
                {typeof diligenceReport.readiness_score === "number" ? (
                  <div className="rounded-xl border border-[var(--navy)] bg-[var(--navy)] p-5 text-white shadow-[var(--shadow-panel)]">
                    <p className="text-sm text-slate-300">Investor-readiness score</p>
                    <p className="mt-2 text-4xl font-semibold tabular-nums">{diligenceReport.readiness_score}</p>
                    <p className="mt-2 text-sm text-slate-300">From stored diligence report</p>
                  </div>
                ) : null}
              </div>
            </section>

            {sections.length > 0 ? (
              <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                <div className="grid gap-4">
                  {sections.map((section) => (
                    <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="font-semibold text-slate-950">{section.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{section.body}</p>
                    </article>
                  ))}
                </div>
                <aside className="grid gap-4">
                  {[
                    ["Risk flags", riskFlags],
                    ["Missing documents", missingDocuments],
                    ["Recommended next steps", recommendations],
                  ].map(([title, items]) => (
                    <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="font-semibold text-slate-950">{title as string}</h2>
                      {(items as string[]).length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">None listed.</p>
                      ) : (
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {(items as string[]).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </aside>
              </section>
            ) : null}
          </>
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
