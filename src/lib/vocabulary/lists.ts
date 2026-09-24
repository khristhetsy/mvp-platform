/**
 * The option lists, and the code values that stand in when the table cannot
 * answer.
 *
 * Pure: no database, no server-only imports, so a client component can hold
 * this as its fallback and render exactly what it renders today if the
 * provider above it is missing. A picker that comes up empty is worse than one
 * showing a slightly stale list.
 */

export type VocabularyList =
  | "industry"
  | "funding_stage"
  | "operating_stage"
  | "investor_type"
  | "capital_type"
  | "use_of_funds"
  | "revenue_band"
  | "geography"
  | "business_entity"
  // Revenue and financials, split out of the shared revenue_band list
  // (20260924003). Slugs are the exact values stored on companies today, so
  // no stored answer changes; labels can be reworded freely.
  | "revenue_size"
  | "revenue_stage"
  | "arr_band"
  | "mrr_band"
  | "money_band";

export type VocabularyOption = {
  /** Stored on the record. Permanent — answers point at it. */
  slug: string;
  /** Shown to the reader. Free to be reworded at any time. */
  label: string;
  /** Not offered to anyone new; still resolves for records that hold it. */
  archived: boolean;
  /** Second line shown under the label. Only revenue stage uses it today. */
  description?: string | null;
};

export type Vocabularies = Record<VocabularyList, VocabularyOption[]>;

function offer(pairs: [string, string][]): VocabularyOption[] {
  return pairs.map(([slug, label]) => ({ slug, label, archived: false }));
}

/** A list whose stored value is its label, as the banded fields are. */
function same(values: readonly string[]): VocabularyOption[] {
  return values.map((v) => ({ slug: v, label: v, archived: false }));
}

/**
 * Exactly what the forms offered before the table existed.
 *
 * This is the fallback, not the source. It is deliberately the OLD set rather
 * than the new one: if the table is unreachable, the safe behaviour is the
 * behaviour that shipped, not a half-applied migration.
 */
export const CODE_FALLBACK: Vocabularies = {
  industry: offer([
    ["fintech", "FinTech"],
    ["healthtech", "HealthTech"],
    ["saas-b2b-software", "SaaS / B2B Software"],
    ["edtech", "EdTech"],
    ["cleantech", "CleanTech"],
    ["ecommerce", "E-commerce"],
    ["ai-ml", "AI / ML"],
    ["real-estate", "Real Estate"],
    ["consumer", "Consumer"],
    ["deep-tech", "Deep Tech"],
    ["marketplace", "Marketplace"],
    ["logistics", "Logistics"],
    ["hardware", "Hardware"],
    ["other", "Other"],
  ]),
  funding_stage: offer([
    ["pre-seed", "Pre-seed"],
    ["seed", "Seed"],
    ["series-a", "Series A"],
    ["series-b", "Series B"],
    ["growth", "Growth"],
    ["other", "Other"],
  ]),
  operating_stage: offer([
    ["idea", "Idea"],
    ["building-mvp", "Building / MVP"],
    ["pre-revenue", "Pre-revenue"],
    ["revenue", "Revenue"],
    ["scaling", "Scaling"],
  ]),
  investor_type: offer([
    ["individual-angel", "Individual angel"],
    ["angel-group-syndicate", "Angel group / syndicate"],
    ["family-office", "Family office"],
    ["venture-fund", "Venture fund"],
    ["corporate-strategic", "Corporate / strategic"],
    ["other", "Other"],
  ]),
  capital_type: offer([
    ["equity", "Equity"],
    ["safe", "SAFE"],
    ["convertible-note", "Convertible note"],
    ["venture-debt", "Venture debt"],
    ["revenue-based", "Revenue-based"],
  ]),
  use_of_funds: offer([
    ["hire-team", "Hire team"],
    ["build-product", "Build product"],
    ["marketing-sales", "Marketing & sales"],
    ["rd", "R&D"],
    ["operations", "Operations"],
    ["international-expansion", "International expansion"],
    ["working-capital", "Working capital"],
  ]),
  revenue_band: offer([
    ["pre-revenue", "Pre-revenue"],
    ["under-100k", "Under $100k"],
    ["100k-500k", "$100k – $500k"],
    ["500k-1m", "$500k – $1M"],
    ["1m-5m", "$1M – $5M"],
    ["5m-plus", "$5M+"],
  ]),
  geography: offer([
    ["north-america", "North America"],
    ["europe", "Europe"],
    ["latam", "LATAM"],
    ["apac", "APAC"],
    ["mena", "MENA"],
    ["africa", "Africa"],
    ["global", "Global"],
  ]),
  business_entity: offer([
    ["delaware-c-corp", "Delaware C-Corp"],
    ["llc", "LLC"],
    ["s-corp", "S-Corp"],
    ["public-benefit-corp", "Public benefit corp"],
    ["not-yet-incorporated", "Not yet incorporated"],
  ]),
  // Keep these five identical to src/lib/profile/options.ts, which the matcher
  // and validation read. A test enforces it.
  revenue_size: same(["Pre-revenue", "Under $100k", "$100k – $500k", "$500k – $1M", "$1M – $5M", "$5M+"]),
  revenue_stage: [
    { slug: "pre_revenue", label: "Pre-revenue", archived: false, description: "Idea, prototype, or early development" },
    { slug: "early_revenue", label: "Early revenue", archived: false, description: "Up to $100K ARR" },
    { slug: "growing", label: "Growing", archived: false, description: "$100K – $1M ARR" },
    { slug: "scaling", label: "Scaling", archived: false, description: "$1M+ ARR" },
  ],
  arr_band: same(["None", "Under $100k", "$100k – $500k", "$500k – $1M", "$1M – $5M", "$5M+"]),
  mrr_band: same(["None", "Under $10k", "$10k – $50k", "$50k – $100k", "$100k+"]),
  money_band: same([
    "Less than $50k", "$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $1m",
    "$1m - $10m", "$10m - $50m", "$50m - $100m", "Over $100m",
  ]),
};

export const VOCABULARY_LISTS = Object.keys(CODE_FALLBACK) as VocabularyList[];

/** The options a picker should offer — archived values are not on the menu. */
export function offered(options: VocabularyOption[]): VocabularyOption[] {
  return options.filter((o) => !o.archived);
}

/**
 * The slug a stored value refers to, matching on slug or label.
 *
 * Comparison ignores case, spacing and separators, so "AI / ML", "ai-ml" and
 * "AI/ML" resolve to one option. Returns null when the value belongs to no
 * option — the caller decides what to do, and nothing is guessed on its behalf.
 */
export function resolveSlug(options: VocabularyOption[], value: string | null | undefined): string | null {
  const key = compare(value ?? "");
  if (!key) return null;
  for (const o of options) {
    if (compare(o.slug) === key || compare(o.label) === key) return o.slug;
  }
  return null;
}

/** What to show for a stored value. Unknown values render as themselves. */
export function labelOf(options: VocabularyOption[], value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const slug = resolveSlug(options, v);
  return options.find((o) => o.slug === slug)?.label ?? v;
}

function compare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
