import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingBySlug, getLiveSlugs } from "@/lib/marketplace/queries";
import { marketplaceCopy } from "@/lib/marketplace/copy";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { ComplianceFooter } from "@/components/marketplace/ComplianceFooter";
import { MarketplaceTopbar } from "@/components/marketplace/MarketplaceTopbar";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // The build must not require a live database. When Supabase env is absent
  // (e.g. CI with no secrets), pre-render nothing and let pages render on demand
  // via ISR — same graceful-degradation pattern already used in sitemap.ts.
  try {
    const slugs = await getLiveSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Offering not found | iCapOS" };
  return {
    title: `${listing.companyName} — Reg CF offering on ${listing.portalName} | iCapOS`,
    description: listing.briefDescription,
  };
}

export default async function MarketplaceListingPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  // Unknown / paused / closed slugs 404 — never render a closed listing publicly.
  if (!listing) notFound();

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#16223F]">
      <MarketplaceTopbar />
      <div className="mx-auto max-w-[560px] px-6 py-10">
        <Link href="/marketplace" className="text-[13px] text-[#1A6CE4] hover:underline">
          ← {marketplaceCopy.section.heading}
        </Link>
        <div className="mt-4">
          {/* Same tombstone constraint as the grid card, with the interest form open by default. */}
          <ListingCard listing={listing} defaultOpen />
        </div>
      </div>
      <div className="mx-auto max-w-[1020px] px-6">
        <ComplianceFooter />
      </div>
    </div>
  );
}
