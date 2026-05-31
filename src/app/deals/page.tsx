import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const supabase = createServiceRoleClient();
  let listings: Awaited<ReturnType<typeof listMarketplaceListings>> = [];

  try {
    const raw = await listMarketplaceListings(supabase);
    listings = filterPublicMarketplaceListings(raw);
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
    <main className="cap-marketing-surface min-h-screen text-slate-950">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Investor marketplace</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Reviewed private opportunities with diligence context.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            Browse admin-approved, published companies. Listings are shown for informational purposes only and are not
            investment recommendations.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} live on the marketplace
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-14 lg:grid-cols-3">
        {listings.length === 0 ? (
          <MarketingMarketplacePlaceholder />
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
