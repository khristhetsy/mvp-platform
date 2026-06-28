import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const fields = ["Company name", "Industry", "Stage", "Location", "Funding target", "Revenue stage"];

export default function SubmitCompanyPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <CapitalOSLogo height={48} tagline priority className="mb-6" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Submit company</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--navy)] md:text-5xl">
              Start your iCapOS readiness review.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Share company basics, funding goals, traction context, and diligence materials. This does not guarantee
              funding or investor participation.
            </p>
            <p className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Preview — create a free account to fill this out and save your readiness draft.
            </p>
          </div>
          <form className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] p-5">
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
                  className="cap-btn-secondary rounded-lg px-4 py-2.5 text-center text-sm font-semibold"
                >
                  Continue full onboarding
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="cap-btn-primary rounded-lg px-4 py-2.5 text-center text-sm font-semibold"
                >
                  Create account to submit
                </Link>
              </div>
            </div>
          </form>
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
