import type { MarketplaceListing } from "@/lib/data/marketplace";

const DEMO_NAME_PATTERN = /\b(test|demo|sample|mock|placeholder|lorem|acme\s*inc)\b/i;

function hasMeaningfulText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "—" && trimmed !== "-");
}

export function isPublicMarketplaceListing(listing: MarketplaceListing) {
  const name = listing.companyName?.trim() ?? "";
  if (!name || name.length < 2) return false;
  if (DEMO_NAME_PATTERN.test(name)) return false;

  const hasSummary = hasMeaningfulText(listing.shortSummary) || hasMeaningfulText(listing.overview);
  if (!hasSummary) return false;

  const hasContext =
    hasMeaningfulText(listing.industry) ||
    hasMeaningfulText(listing.stage) ||
    hasMeaningfulText(listing.fundingTarget);

  return hasContext;
}

export function filterPublicMarketplaceListings(listings: MarketplaceListing[]) {
  return listings.filter(isPublicMarketplaceListing);
}
