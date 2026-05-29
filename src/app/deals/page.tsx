import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const supabase = createServiceRoleClient();
  let listings: Awaited<ReturnType<typeof listMarketplaceListings>> = [];

  try {
    listings = await listMarketplaceListings(supabase);
  } catch {
    listings = [];
  }

  const pledgeSummaries =
    listings.length > 0
      ? await getCompanyPledgeSummaries(
          supabase,
          listings.map((deal) => deal.id),
        )
      : {};

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Investor marketplace</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Reviewed private opportunities with diligence context.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
            Browse admin-approved, published companies. Listings are shown for informational purposes only and are not
            investment recommendations.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} live on the marketplace
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-16 lg:grid-cols-3">
        {listings.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
            No published opportunities yet. Approved companies will appear here once published to the marketplace.
          </div>
        ) : (
          listings.map((deal) => (
            <OpportunityCard
              key={deal.id}
              deal={deal}
              pledgeSummary={pledgeSummaries[deal.id] ?? emptyCompanyPledgeSummary()}
            />
          ))
        )}
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
