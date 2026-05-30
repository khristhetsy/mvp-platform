import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { PlanComparisonSection } from "@/components/PlanComparisonSection";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Pricing</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
            Enterprise-ready plans for founders and investors.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Start with a 3-day founder trial, scale into Basic or Professional when you are ready. Investor accounts are
            always free. Payment checkout is coming soon — request an upgrade today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
            >
              Create account
            </Link>
            <Link
              href="/upgrade"
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View upgrade options
            </Link>
          </div>
        </div>
        <div className="mt-14">
          <PlanComparisonSection />
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
