import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
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
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">For founders</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
            Become capital-ready before entering the market.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            CapitalOS helps founders organize diligence, validate traction, structure campaign materials, and prepare
            for investor review.
          </p>
          <Link href="/submit-company" className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white">
            Submit your company
          </Link>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">Readiness checklist</p>
            <div className="mt-5 grid gap-3">
              {["Company profile", "Financial documents", "Cap table", "Legal package", "Traction evidence"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm">
                  <span className="font-medium text-slate-700">{item}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Review</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
              <p className="mt-8 text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
