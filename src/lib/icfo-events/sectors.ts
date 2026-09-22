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

/**
 * One spelling of a sector, whatever it arrived as.
 *
 * The two registration paths disagreed: the public form's interest chips wrote
 * slugs ("fintech"), while the field-set questions wrote the label the
 * registrant read ("FinTech"), and matching compared the two as raw strings.
 * Someone registered by staff therefore shared no sector with someone who
 * registered themselves, and a rename would have orphaned every stored answer.
 *
 * Comparison ignores case, spacing and the separators the labels carry, so
 * "AI / ML", "ai-ml" and "AI/ML" are one sector.
 */
function compare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const BY_COMPARE = new Map<string, string>();
for (const s of EVENT_SECTORS) {
  BY_COMPARE.set(compare(s.slug), s.slug);
  BY_COMPARE.set(compare(s.label), s.slug);
}

/** The canonical slug for a slug or a label, or null when it is neither. */
export function toSectorSlug(value: string | null | undefined): string | null {
  const key = compare((value ?? "").trim());
  return key ? BY_COMPARE.get(key) ?? null : null;
}

/**
 * A stored list of sectors as canonical slugs, de-duplicated.
 *
 * A value that matches no sector is kept in its compared form rather than
 * dropped: two people who both typed "Agtech" still have something in common,
 * and discarding it would quietly shrink the room.
 */
export function normalizeSectors(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const trimmed = (v ?? "").trim();
    if (!trimmed) continue;
    out.push(toSectorSlug(trimmed) ?? trimmed.toLowerCase());
  }
  return [...new Set(out)];
}
