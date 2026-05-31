import Link from "next/link";
import { Building2, LineChart, Shield } from "lucide-react";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";

export function MarketingMarketplacePlaceholder() {
  return (
    <div className="col-span-full grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[var(--shadow-panel)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Building2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Curated opportunities launching soon</h3>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
          Admin-reviewed companies will appear here once diligence, disclosures, and marketplace publication are complete.
          Until then, explore how CapitalOS structures readiness and investor review.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-slate-700">
          {[
            { icon: Shield, text: "Diligence summaries and risk context on every listing" },
            { icon: LineChart, text: "Readiness signals and traction validation before publication" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" strokeWidth={1.75} aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/submit-company"
            className="cap-btn-primary inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            Submit your company
          </Link>
          <Link
            href="/founders"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-300"
          >
            Founder workflow
          </Link>
        </div>
      </div>
      <MarketingDashboardPreview />
    </div>
  );
}
