import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DealCard } from "@/components/DealCard";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { deals, investorActivity } from "@/lib/mock-data";

export default function InvestorDashboardPage() {
  return (
    <AppShell role="INVESTOR">
      <SectionHeader
        eyebrow="Investor dashboard"
        title="Your private deal workflow"
        description="Track saved deals, expressed interest, recently viewed opportunities, and recommended companies from the curated marketplace."
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="Saved deals" value={String(investorActivity.savedDeals.length)} detail={investorActivity.savedDeals.join(", ")} />
        <MetricCard label="Expressed interest" value={String(investorActivity.expressedInterest.length)} detail={investorActivity.expressedInterest.join(", ")} />
        <MetricCard label="Recently viewed" value={String(investorActivity.recentlyViewed.length)} detail={investorActivity.recentlyViewed.join(", ")} />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">Recommended opportunities</h2>
          <Link href="/deals" className="text-sm font-semibold text-slate-700">
            Browse all deals
          </Link>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {deals.map((deal) => (
            <DealCard key={deal.slug} deal={deal} />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        {[
          ["Saved deals", investorActivity.savedDeals],
          ["Expressed interest", investorActivity.expressedInterest],
          ["Recently viewed deals", investorActivity.recentlyViewed],
        ].map(([title, items]) => (
          <div key={title as string} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-950">{title as string}</h2>
            <div className="mt-4 grid gap-3">
              {(items as string[]).map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
