import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";

const fields = [
  ["Company name", "name"],
  ["Industry", "industry"],
  ["Stage", "stage"],
  ["Location", "location"],
  ["Funding amount", "fundingAmount"],
  ["Revenue stage", "revenueStage"],
];

export default async function FounderOnboardingPage() {
  return (
    <FounderAppShell>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Company onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Submit your company for private marketplace review.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This profile becomes the basis for diligence review, deal-page drafting, and admin approval.
          </p>
        </div>

        <form className="mt-8 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            {fields.map(([label, name]) => (
              <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
                {label}
                <input name={name} className="rounded-xl border border-slate-300 px-4 py-3 font-normal" />
              </label>
            ))}
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Business summary
            <textarea name="description" rows={5} className="rounded-xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <div className="grid gap-5 md:grid-cols-3">
            {["Use of funds", "Team summary", "Cap table summary"].map((label) => (
              <label key={label} className="grid gap-2 text-sm font-medium text-slate-700">
                {label}
                <textarea rows={5} className="rounded-xl border border-slate-300 px-4 py-3 font-normal" />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Link href="/founder" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
              Save draft
            </Link>
            <Link href="/founder/documents" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Continue to uploads
            </Link>
          </div>
        </form>
      </section>
    </FounderAppShell>
  );
}
