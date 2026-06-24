import Link from "next/link";
import { Gauge, Star, LayoutGrid, ArrowRight } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingMarketPreview } from "@/components/marketing/MarketingMarketPreview";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TWO_SIDED = [
  { icon: Gauge, title: "Founders earn readiness", copy: "A 0–100 Capital Readiness Score across five diligence dimensions. Only diligence-ready deals reach the market.", color: "bg-[var(--teal-muted)] text-[var(--teal)]" },
  { icon: Star, title: "Investors earn quality", copy: "A two-sided rating means founders see investor quality too — who's active, who deploys, who follows through.", color: "bg-[var(--indigo-soft)] text-[var(--indigo)]" },
  { icon: LayoutGrid, title: "Activity in the open", copy: "Indicated interest, reviews, and score moves are visible — so both sides see a market that's genuinely alive.", color: "bg-[var(--blue-muted)] text-[var(--blue)]" },
];

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
      {/* Hero */}
      <section
        className="px-4 py-12 lg:px-8 lg:py-16"
        style={{ background: "radial-gradient(960px 460px at 75% -10%, var(--blue-muted), transparent 70%)" }}
      >
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--blue-border)] bg-[var(--blue-muted)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--blue)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--blue)] text-[var(--blue)]" />
              Investor marketplace
            </span>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--navy)] md:text-5xl">
              The <span className="text-[var(--blue)]">Private Market</span> where readiness meets capital.
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-slate-600">
              Scored founders, quality investors, and indicated interest in the open. Listings are shown for
              informational purposes only and are not investment recommendations.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/auth/sign-up" className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
                Request access
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link href="/investors" className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
                How it works →
              </Link>
            </div>
          </div>
          <MarketingMarketPreview />
        </div>
      </section>

      {/* Live listings (real data) */}
      <section className="border-t border-slate-200/80 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">Live marketplace</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--navy)]">Published opportunities</h2>
            </div>
            <p className="font-mono text-sm font-medium text-slate-500">
              {listings.length} {listings.length === 1 ? "listing" : "listings"} live · admin-approved
            </p>
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
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
        </div>
      </section>

      {/* Two-sided explainer */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">A two-sided market</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Both sides scored. Both sides see the market move.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {TWO_SIDED.map((c) => (
              <div key={c.title} className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.color}`}>
                  <c.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--navy)]">{c.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{c.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
