import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { sampleCompany, sampleReport } from "@/lib/mock-data";
import { requireRole } from "@/lib/supabase/auth";

export default async function DiligenceReportPage() {
  await requireRole(["founder"]);

  return (
    <FounderAppShell>
      <FounderFeatureGate featureKey="readiness">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">AI diligence report</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{sampleCompany.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{sampleReport.executiveSummary}</p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-6 text-white">
              <p className="text-sm text-slate-300">Investor-readiness score</p>
              <p className="mt-2 text-5xl font-semibold">{sampleCompany.readinessScore}</p>
              <p className="mt-2 text-sm text-slate-300">Out of 100, pending human review</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-4">
            {sampleReport.sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
          <aside className="grid gap-4">
            {[
              ["Risk flags", sampleReport.riskFlags],
              ["Missing documents", sampleReport.missingDocuments],
              ["Recommended next steps", sampleReport.recommendedNextSteps],
            ].map(([title, items]) => (
              <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-950">{title as string}</h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {(items as string[]).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        </section>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
