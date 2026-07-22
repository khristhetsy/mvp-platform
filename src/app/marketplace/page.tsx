import type { Metadata } from "next";
import Link from "next/link";
import { getLiveListings, type Listing } from "@/lib/marketplace/queries";
import { marketplaceCopy } from "@/lib/marketplace/copy";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { LaneExplainer } from "@/components/marketplace/LaneExplainer";
import { PrivateLaneCta } from "@/components/marketplace/PrivateLaneCta";
import { ComplianceFooter } from "@/components/marketplace/ComplianceFooter";
import { MarketplaceTopbar } from "@/components/marketplace/MarketplaceTopbar";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Marketplace — Regulation Crowdfunding offerings | iCapOS",
  description: marketplaceCopy.hero.sub,
};

// Fictional cards for design reference only. Rendered ONLY when
// NEXT_PUBLIC_MARKETPLACE_SAMPLE_MODE=true (must be off in production).
const SAMPLE_LISTINGS: Listing[] = [
  { id: "sample-1", slug: null, companyName: "Northreef Analytics", briefDescription: "Satellite-derived flood risk analytics for regional insurers. Offering conducted on a registered funding portal.", industry: "Climate Data", location: "Austin, TX", offeringAmountMin: 250_000, offeringAmountMax: 1_200_000, securityType: "Crowd SAFE", portalName: "Wefunder", portalUrl: "https://wefunder.com", logoPath: null, readinessBand: "82 · Strong", publishedAt: null },
  { id: "sample-2", slug: null, companyName: "Loveletter Foods", briefDescription: "Regional better-for-you snack brand expanding grocery distribution. Offering conducted on a registered funding portal.", industry: "Consumer / CPG", location: "Portland, OR", offeringAmountMin: 150_000, offeringAmountMax: 900_000, securityType: "Common Equity", portalName: "StartEngine", portalUrl: "https://startengine.com", logoPath: null, readinessBand: "76 · Moderate", publishedAt: null },
  { id: "sample-3", slug: null, companyName: "Quietwatt Energy", briefDescription: "Smart load controllers for small commercial buildings. Offering conducted on a registered funding portal.", industry: "Hardware / Energy", location: "Detroit, MI", offeringAmountMin: 300_000, offeringAmountMax: 2_000_000, securityType: "Crowd Note", portalName: "DealMaker", portalUrl: "https://dealmaker.tech", logoPath: null, readinessBand: "71 · Moderate", publishedAt: null },
];

export default async function MarketplacePage() {
  const sampleMode = process.env.NEXT_PUBLIC_MARKETPLACE_SAMPLE_MODE === "true";
  // Build must not require a live DB — degrade to an empty list if Supabase env
  // is absent (CI). ISR refreshes real listings on the first request in prod.
  const live = await getLiveListings().catch(() => [] as Listing[]);
  const showingSamples = live.length === 0 && sampleMode;
  const listings = live.length > 0 ? live : showingSamples ? SAMPLE_LISTINGS : [];

  const C = marketplaceCopy;

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#16223F]">
      <MarketplaceTopbar />

      <div className="mx-auto max-w-[1020px] px-6">
        <section className="pb-2 pt-10">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.8px] text-[#1A6CE4]">{C.hero.kicker}</div>
          <h1 className="text-[30px] font-bold text-[#0A1A40]">{C.hero.title}</h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-[1.6] text-[#5A6782]">{C.hero.sub}</p>
        </section>

        <LaneExplainer />

        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px] font-bold text-[#0A1A40]">{C.section.heading}</h2>
          {showingSamples ? (
            <span className="rounded-full border border-[#F0DCA8] bg-[#FFF3D6] px-2.5 py-1 text-[11.5px] font-semibold text-[#8A5B00]">
              {C.section.sampleTag}
            </span>
          ) : null}
        </div>
        {showingSamples ? <p className="mb-4 text-[12.5px] text-[#5A6782]">{C.section.sampleNote}</p> : null}

        {listings.length > 0 ? (
          <div className="mb-2.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-[#E3E8F2] bg-white px-8 py-14 text-center">
            <p className="text-[17px] font-bold text-[#0A1A40]">{C.empty.heading}</p>
            <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] text-[#5A6782]">{C.empty.body}</p>
            <Link
              href={C.empty.ctaHref}
              className="mt-5 inline-block rounded-[9px] bg-[linear-gradient(90deg,#0A1A40,#1A6CE4)] px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              {C.empty.ctaLabel}
            </Link>
          </div>
        )}

        <PrivateLaneCta />
        <ComplianceFooter />
      </div>
    </div>
  );
}
