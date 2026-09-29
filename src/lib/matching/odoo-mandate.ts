/**
 * Odoo investor contact fields → the matcher's investor fields.
 *
 * The prospect import used to drop these, so 5,698 of 7,184 Odoo investors had a
 * stated investment size and 5,669 a capital type that the matcher never saw.
 * Pure: the import and its tests read the same tables. The SQL backfill in
 * 20260926000000_prospect_mandate_fields.sql mirrors these tables exactly;
 * change both together.
 */

/** Odoo "Investor investment size?" bands, in dollars. max null = no upper bound. */
export const ODOO_SIZE_BANDS: Record<string, { min: number; max: number | null }> = {
  "Less than $50k": { min: 0, max: 50_000 },
  "$50k - $100k": { min: 50_000, max: 100_000 },
  "$100k - $250k": { min: 100_000, max: 250_000 },
  "$250k - $500k": { min: 250_000, max: 500_000 },
  "$500k - $1m": { min: 500_000, max: 1_000_000 },
  "$1m - $10m": { min: 1_000_000, max: 10_000_000 },
  "$10m - $50m": { min: 10_000_000, max: 50_000_000 },
  "$50m - $100m": { min: 50_000_000, max: 100_000_000 },
  "Over $100m": { min: 100_000_000, max: null },
};

/**
 * Odoo capital types → the platform's capital type labels (the capital_type
 * vocabulary founders pick from). Only these four have a platform counterpart;
 * Human Capital, Social Capital, Other and the bare numeric ids Odoo exports are
 * dropped rather than guessed.
 */
export const ODOO_CAPITAL_MAP: Record<string, string> = {
  "Equity Capital": "Equity",
  "Debt Capital": "Venture debt",
  "Business Loan": "Venture debt",
  "Alternative Financing": "Revenue-based",
};

export const ODOO_SIZE_FIELD = "Investor investment size?";
export const ODOO_ACTIVE_FIELD = "Active investor";

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** The span covered by every band the investor selected. */
export function checkSizeFromOdoo(value: unknown): { min: number | null; max: number | null } {
  const bands = list(value)
    .map((v) => ODOO_SIZE_BANDS[v])
    .filter((b): b is { min: number; max: number | null } => Boolean(b));
  if (bands.length === 0) return { min: null, max: null };
  const min = Math.min(...bands.map((b) => b.min));
  const max = bands.some((b) => b.max === null) ? null : Math.max(...bands.map((b) => b.max as number));
  return { min, max };
}

export function capitalTypesFromOdoo(value: unknown): string[] {
  const out = list(value)
    .map((v) => ODOO_CAPITAL_MAP[v])
    .filter((v): v is string => Boolean(v));
  return [...new Set(out)];
}

/** "5-Excellent" → 5. "Other", blank, or anything without a leading 1 to 5 → null. */
export function activeRatingFromOdoo(value: unknown): number | null {
  const first = list(value)[0];
  const m = first?.match(/^([1-5])-/);
  return m ? Number(m[1]) : null;
}
