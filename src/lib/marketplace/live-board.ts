import type { MarketplaceListing } from "@/lib/data/marketplace";

/**
 * A live, admin-approved listing shaped for the public deals board.
 * Public fields only. Pledged and indicated amounts stay off this board while
 * crowdfunding is paused, and per-company readiness scores are investor-only.
 */
export type LiveBoardRow = {
  slug: string;
  symbol: string;
  name: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  summary: string | null;
  target: string | null;
  minimum: string | null;
  capitalReady: boolean;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "—" && trimmed !== "-" ? trimmed : null;
}

/** Board symbol from a company name: letters and digits only, upper case, at most six characters. */
export function tickerSymbol(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 6) || "DEAL";
}

export function toLiveBoardRow(listing: MarketplaceListing): LiveBoardRow {
  return {
    slug: listing.slug,
    symbol: tickerSymbol(listing.companyName),
    name: listing.companyName,
    industry: clean(listing.industry),
    stage: clean(listing.stage),
    location: clean(listing.location),
    summary: clean(listing.shortSummary) ?? clean(listing.overview),
    target: clean(listing.fundingTarget),
    minimum: clean(listing.minimumInvestment),
    capitalReady: Boolean(listing.capitalReadyAt),
  };
}
