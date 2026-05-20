import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { OpportunityCard } from "@/components/OpportunityCard";
import { deals } from "@/lib/mock-data";

export default function DealsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Investor marketplace preview</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Reviewed private opportunities with AI diligence context.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
            Browse mock opportunities that demonstrate the IFUNDCROWD marketplace experience. Listings are shown for
            product preview only and are not investment recommendations.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            {["All", "Seed", "Series A", "AI", "Fintech", "Digital Health"].map((filter) => (
              <button key={filter} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700">
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-16 lg:grid-cols-3">
        {deals.map((deal) => (
          <OpportunityCard key={deal.slug} deal={deal} />
        ))}
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
