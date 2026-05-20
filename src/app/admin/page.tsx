import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { deals, sampleDocuments } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  return (
    <AppShell role="ADMIN">
      <SectionHeader
        eyebrow="Admin dashboard"
        title="Review and publish curated opportunities"
        description="Manage submitted companies, pending diligence reviews, AI reports, approval decisions, and marketplace publication."
      />

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Submitted companies" value="12" detail="4 pending first review" />
        <MetricCard label="Pending reviews" value="4" detail="AI diligence and analyst notes required" />
        <MetricCard label="AI reports" value="10" detail="2 missing legal sections" />
        <MetricCard label="Published deals" value="5" detail="Visible to approved investors" />
      </section>

      <section className="mt-8 grid gap-5">
        {deals.map((deal) => (
          <article key={deal.slug} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {deal.industry} · {deal.stage}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{deal.companyName}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{deal.shortSummary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Reject", "Approve", "Publish campaign"].map((action) => (
                  <button key={action} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                    {action}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">AI diligence report</h3>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {deal.diligenceSummary}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Documents</h3>
                <div className="mt-3 divide-y divide-slate-100">
                  {sampleDocuments.map((document) => (
                    <div key={`${deal.slug}-${document.type}`} className="flex justify-between py-3 text-sm">
                      <span className="font-medium text-slate-800">{document.name}</span>
                      <span className="text-slate-500">{document.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Review notes</h2>
        <textarea
          className="mt-3 min-h-40 w-full rounded-2xl border border-slate-300 p-4 text-sm"
          placeholder="Add analyst or admin review notes..."
        />
      </section>
    </AppShell>
  );
}
