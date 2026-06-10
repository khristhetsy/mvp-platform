import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CapitalReadyBadge } from "@/components/CapitalReadyBadge";
import { CompanyPledgeSummaryBlock } from "@/components/CompanyPledgeSummary";
import type { MarketplaceListing } from "@/lib/data/marketplace";
import type { CompanyPledgeSummary } from "@/lib/data/investor-pledges";

export function OpportunityCard({
  deal,
  pledgeSummary,
}: Readonly<{ deal: MarketplaceListing; pledgeSummary: CompanyPledgeSummary }>) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--gold)]">{deal.industry ?? "Private company"}</p>
        <h3 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
          <span className="truncate">{deal.companyName}</span>
          {deal.capitalReadyAt ? <CapitalReadyBadge /> : null}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {[deal.stage, deal.location].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <p className="mt-3 flex-1 line-clamp-3 text-sm leading-6 text-slate-600">
        {deal.shortSummary ?? deal.overview ?? "—"}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Target</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-950">{deal.fundingTarget}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Minimum</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-950">{deal.minimumInvestment}</p>
        </div>
      </div>
      <div className="mt-3">
        <CompanyPledgeSummaryBlock summary={pledgeSummary} compact />
      </div>
      <Link
        href={`/deals/${deal.slug}`}
        className="cap-btn-primary mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold"
      >
        View opportunity
        <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </Link>
    </article>
  );
}
