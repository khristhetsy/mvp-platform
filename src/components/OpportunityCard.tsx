import Link from "next/link";
import { CompanyPledgeSummaryBlock } from "@/components/CompanyPledgeSummary";
import type { MarketplaceListing } from "@/lib/data/marketplace";
import type { CompanyPledgeSummary } from "@/lib/data/investor-pledges";

export function OpportunityCard({
  deal,
  pledgeSummary,
}: Readonly<{ deal: MarketplaceListing; pledgeSummary: CompanyPledgeSummary }>) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{deal.industry ?? "Private company"}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{deal.companyName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {[deal.stage, deal.location].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      <p className="mt-5 flex-1 text-sm leading-6 text-slate-600">
        {deal.shortSummary ?? deal.overview ?? "—"}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Target</p>
          <p className="mt-1 font-semibold text-slate-950">{deal.fundingTarget ?? "—"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Minimum</p>
          <p className="mt-1 font-semibold text-slate-950">{deal.minimumInvestment ?? "—"}</p>
        </div>
      </div>
      <div className="mt-3">
        <CompanyPledgeSummaryBlock summary={pledgeSummary} compact />
      </div>
      <Link
        href={`/deals/${deal.slug}`}
        className="mt-6 inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
      >
        View opportunity
      </Link>
    </article>
  );
}
