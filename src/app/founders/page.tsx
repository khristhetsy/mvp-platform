import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const steps = [
  "Submit company, stage, traction, funding target, and use of funds",
  "Upload diligence documents into a private review workflow",
  "Receive AI-generated summaries, missing item checks, and risk flags",
  "Move toward admin-approved marketplace publication when ready",
];

export default function FoundersPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <CapitalOSLogo height={48} priority className="mb-6" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">For founders</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--navy)] md:text-5xl">
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
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
              <span className="text-xs font-semibold text-[var(--gold)]">0{index + 1}</span>
              <p className="mt-3 text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
