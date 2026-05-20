import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { founderPipeline, sampleCompany, sampleDocuments } from "@/lib/mock-data";

export default function FounderDashboardPage() {
  return (
    <AppShell role="FOUNDER">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeader
          eyebrow="Founder dashboard"
          title={sampleCompany.name}
          description="Track your company submission, diligence readiness, data room completion, and marketplace publication status."
        />
        <Link href="/founder/onboarding" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
          Update company profile
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="Company profile status" value={founderPipeline.profileStatus} detail={sampleCompany.description} />
        <MetricCard label="Readiness score" value={`${founderPipeline.readinessScore}/100`} detail={founderPipeline.diligenceProgress} />
        <MetricCard label="Campaign status" value={founderPipeline.campaignStatus} detail="Admin approval required before investor visibility" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Next actions</h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            {founderPipeline.nextSteps.map((step) => (
              <div key={step} className="rounded-xl border border-slate-200 p-4 font-medium">
                {step}
              </div>
            ))}
          </div>
          <Link href="/deals/nova-analytics" className="mt-5 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800">
            Preview deal page
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">Document upload status</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {founderPipeline.documentStatus}
            </span>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {sampleDocuments.map((document) => (
              <div key={document.type} className="flex items-center justify-between py-4 text-sm">
                <span className="font-medium text-slate-800">{document.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{document.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
