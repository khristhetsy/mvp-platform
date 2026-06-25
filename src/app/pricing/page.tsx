import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PlanComparisonSection } from "@/components/PlanComparisonSection";

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--navy)] md:text-5xl">
            Enterprise-ready plans for founders and investors.
          </h1>
          <p className="mt-6 text-base leading-7 text-slate-600 md:text-lg">
            Start with a 3-day founder trial, then upgrade to Basic or Professional anytime from your billing page.
            Investor accounts are always free.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth/sign-up" className="cap-btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold">
              Create account
            </Link>
            <Link
              href="/upgrade"
              className="cap-btn-secondary rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              View upgrade options
            </Link>
          </div>
        </div>
        <div className="mt-12">
          <PlanComparisonSection />
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
