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

export function isValidSectorSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function sectorLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
