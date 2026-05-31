import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";

const fields = ["Company name", "Industry", "Stage", "Location", "Funding target", "Revenue stage"];

export default function SubmitCompanyPage() {
  return (
    <main className="cap-marketing-surface min-h-screen text-slate-950">
      <MarketingNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Submit company</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Start your CapitalOS readiness review.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Share company basics, funding goals, traction context, and diligence materials. This does not guarantee
            funding or investor participation.
          </p>
        </div>
        <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <div className="rounded-xl border border-slate-100 bg-[var(--surface-sunken)] p-5">
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field} className="grid gap-1.5 text-sm font-medium text-slate-700">
                  {field}
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
                    placeholder={field}
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 grid gap-1.5 text-sm font-medium text-slate-700">
              Business summary
              <textarea className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm" rows={5} />
            </label>
            <label className="mt-3 grid gap-1.5 text-sm font-medium text-slate-700">
              Use of funds
              <textarea className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm" rows={4} />
            </label>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Link
                href="/founder/onboarding"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:border-indigo-200"
              >
                Continue full onboarding
              </Link>
              <button className="cap-btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold" type="button">
                Save readiness draft
              </button>
            </div>
          </div>
        </form>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
