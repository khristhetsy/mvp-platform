// Shared sector taxonomy for iCFO Events. Aligned to the founder onboarding
// industry vocabulary so event tracks, company industries, and matching all
// speak the same language. `slug` is the stable key; `label` is for display.

export type EventSector = { slug: string; label: string };

export const EVENT_SECTORS: EventSector[] = [
  { slug: "fintech", label: "FinTech" },
  { slug: "healthtech", label: "HealthTech" },
  { slug: "saas", label: "SaaS / B2B Software" },
  { slug: "edtech", label: "EdTech" },
  { slug: "cleantech", label: "CleanTech" },
  { slug: "ecommerce", label: "E-commerce" },
  { slug: "ai-ml", label: "AI / ML" },
  { slug: "real-estate", label: "Real Estate" },
  { slug: "consumer", label: "Consumer" },
  { slug: "deep-tech", label: "Deep Tech" },
  { slug: "marketplace", label: "Marketplace" },
  { slug: "logistics", label: "Logistics" },
  { slug: "hardware", label: "Hardware" },
  { slug: "other", label: "Other" },
];

const BY_SLUG = new Map(EVENT_SECTORS.map((s) => [s.slug, s]));

/**
 * Whether a value is shaped like a sector key.
 *
 * This used to check membership of the fourteen hardcoded sectors. Now that
 * the list is editable, that check would reject every industry added after
 * this file was written: staff could pick the new value and the save would
 * fail validation with "Unknown sector". The authoritative list is the
 * vocabulary table, so what is enforced here is the shape — lowercase letters,
 * digits and single hyphens — and an unknown key simply renders as itself.
 */
export function isValidSectorSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}

/** Whether it is one of the sectors this file shipped with. */
export function isSeededSectorSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function sectorLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
