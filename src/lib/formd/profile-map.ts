// Snap Form D–derived values onto the CRM's existing founder-profile dropdown
// vocabulary. These fields are fixed Odoo selection / many2many pickers, so we
// must map to an option that already exists — never invent a new category
// (matches the option lists surfaced by contact-field-options.ts). Values that
// don't map cleanly are left blank; exact figures live in the contact note.
//
// Vocabularies confirmed from the live population (Aug 2026):
//   investor type : Angel Investor, Family Office, Private Equity,
//                   Venture Capital, Hedge Fund, Represent Investors
//   amount band   : $250k - $500k, $500k - $1m, $1m - $10m, $10m - $50m,
//                   $50m - $100m
//   revenue band  : Pre-revenue, Less than $50k, $50k - $100k, $100k - $250k,
//                   $250k - $500k, $500k - $1m, $1m - $10m, $10m - $50m
//   funding stage : Pre-Seed, Seed Round, Series A, Series B, Series C, Other
//   business entity (really public/private status): Private Held, Going Public,
//                   Publicly Traded

/** Amount raise bands (upper bound exclusive) → existing option label. */
const AMOUNT_BANDS: Array<{ max: number; label: string }> = [
  { max: 500_000, label: "$250k - $500k" },
  { max: 1_000_000, label: "$500k - $1m" },
  { max: 10_000_000, label: "$1m - $10m" },
  { max: 50_000_000, label: "$10m - $50m" },
  { max: Infinity, label: "$50m - $100m" },
];

export function amountBand(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return (AMOUNT_BANDS.find((b) => n < b.max) ?? AMOUNT_BANDS[AMOUNT_BANDS.length - 1]).label;
}

/** SEC Form D revenueRange option → nearest CRM revenue band (else blank). */
const REVENUE_MAP: Record<string, string> = {
  "no revenues": "Pre-revenue",
  "$1 - $1,000,000": "$500k - $1m",
  "$1,000,001 - $5,000,000": "$1m - $10m",
  "$5,000,001 - $25,000,000": "$10m - $50m",
  "$25,000,001 - $100,000,000": "$10m - $50m",
  "over $100,000,000": "$10m - $50m",
};

export function revenueBand(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  if (k.includes("decline") || k.includes("not applicable") || k === "n/a") return null;
  if (k.includes("no revenue") || k.includes("pre-revenue")) return "Pre-revenue";
  return REVENUE_MAP[k] ?? null;
}

/** Derived funding stage → existing stage option. */
export function fundingStageOption(stage: string | null | undefined): string | null {
  if (!stage) return null;
  const s = stage.trim().toLowerCase();
  if (s.includes("pre-seed") || s.includes("preseed")) return "Pre-Seed";
  if (s.includes("seed")) return "Seed Round";
  if (s.includes("series a")) return "Series A";
  if (s.includes("series b")) return "Series B"; // covers "Series B+"
  if (s.includes("series c") || s.includes("series d") || s.includes("growth") || s.includes("late")) return "Series C";
  return "Other";
}

/**
 * Form D investor signals → existing many2many investor-type options.
 * Accredited individuals / angels are the classic angel profile; institutional
 * language maps to the matching fund type. Returns [] when nothing maps.
 */
export function investorTypeOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.toLowerCase();
  const out = new Set<string>();
  if (s.includes("angel") || s.includes("accredited") || s.includes("individual")) out.add("Angel Investor");
  if (s.includes("family office")) out.add("Family Office");
  if (s.includes("venture") || s.includes(" vc")) out.add("Venture Capital");
  if (s.includes("private equity") || s.includes(" pe ")) out.add("Private Equity");
  if (s.includes("hedge")) out.add("Hedge Fund");
  return Array.from(out);
}

/** Every Form D issuer is a private placement → Private Held. */
export function businessEntityStatus(): string {
  return "Private Held";
}
