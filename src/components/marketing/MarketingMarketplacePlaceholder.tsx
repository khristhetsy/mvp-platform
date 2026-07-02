import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, LineChart, Shield } from "lucide-react";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";

export function MarketingMarketplacePlaceholder() {
  const t = useTranslations("sharedCmp");
  return (
    <div className="col-span-full grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-[var(--shadow-panel)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--navy-muted)] text-[var(--navy)]">
          <Building2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--navy)]">{t("curated_opportunities_launching_soon")}</h3>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
          Admin-reviewed companies will appear here once diligence, disclosures, and marketplace publication are complete.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-slate-700">
          {[
            { icon: Shield, text: "Diligence summaries and risk context on every listing" },
            { icon: LineChart, text: "Readiness signals and traction validation before publication" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/submit-company" className="cap-btn-primary inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold">
            Submit your company
          </Link>
          <Link href="/founders" className="cap-btn-secondary inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold">
            Founder workflow
          </Link>
        </div>
      </div>
      <MarketingDashboardPreview />
    </div>
  );
}
