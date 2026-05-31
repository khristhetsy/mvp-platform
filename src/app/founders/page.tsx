import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";

const steps = [
  "Submit company, stage, traction, funding target, and use of funds",
  "Upload diligence documents into a private review workflow",
  "Receive AI-generated summaries, missing item checks, and risk flags",
  "Move toward admin-approved marketplace publication when ready",
];

export default function FoundersPage() {
  return (
    <main className="cap-marketing-surface min-h-screen text-slate-950">
      <MarketingNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">For founders</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Become capital-ready before entering the market.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            CapitalOS helps founders organize diligence, validate traction, structure campaign materials, and prepare
            for investor review.
          </p>
          <Link href="/submit-company" className="cap-btn-primary mt-7 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold">
            Submit your company
          </Link>
        </div>
        <MarketingDashboardPreview />
      </section>
      <section className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-12 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-xl border border-slate-200/80 bg-[var(--background)] p-5 shadow-[var(--shadow-panel)]">
              <span className="text-xs font-semibold text-indigo-600">0{index + 1}</span>
              <p className="mt-4 text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
