import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingShell } from "@/components/marketing/MarketingShell";
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
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] lg:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Investor marketplace</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-[var(--navy)] md:text-4xl">
            Reviewed private opportunities with diligence context.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Browse admin-approved, published companies. Listings are shown for informational purposes only and are not
            investment recommendations.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} live on the marketplace
          </p>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
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
        </div>
      </section>
      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
