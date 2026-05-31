import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
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
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">For investors</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
            Review curated private opportunities with diligence context.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Explore marketplace-ready companies, AI diligence summaries, risk disclosures, and non-binding investor
            actions in one professional workflow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/deals" className="cap-btn-primary rounded-lg px-6 py-3 text-center text-sm font-semibold">
              Explore opportunities
            </Link>
            <Link href="/login" className="rounded-full border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-800">
              Investor login
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-16 lg:grid-cols-3">
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
