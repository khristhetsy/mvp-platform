import Link from "next/link";
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
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">For investors</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--navy)] md:text-5xl">
            Review curated private opportunities with diligence context.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Explore marketplace-ready companies, AI diligence summaries, risk disclosures, and non-binding investor
            actions in one professional workflow.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/deals" className="cap-btn-primary rounded-lg px-5 py-2.5 text-center text-sm font-semibold">
              Explore opportunities
            </Link>
            <Link href="/login" className="cap-btn-secondary rounded-lg px-5 py-2.5 text-center text-sm font-semibold">
              Investor login
            </Link>
          </div>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
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
