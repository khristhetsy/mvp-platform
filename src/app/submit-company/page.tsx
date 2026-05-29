import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";

const fields = ["Company name", "Industry", "Stage", "Location", "Funding target", "Revenue stage"];

export default function SubmitCompanyPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Submit company</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
            Start your CapitalOS readiness review.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Share company basics, funding goals, traction context, and diligence materials. This does not guarantee
            funding or investor participation.
          </p>
        </div>
        <form className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field} className="grid gap-2 text-sm font-medium text-slate-700">
                  {field}
                  <input className="rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder={field} />
                </label>
              ))}
            </div>
            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Business summary
              <textarea className="rounded-xl border border-slate-300 px-4 py-3 font-normal" rows={5} />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Use of funds
              <textarea className="rounded-xl border border-slate-300 px-4 py-3 font-normal" rows={4} />
            </label>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link href="/founder/onboarding" className="rounded-full border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-800">
                Continue full onboarding
              </Link>
              <button className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white" type="button">
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
