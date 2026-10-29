/**
 * `companies.industry` is one text column holding a comma separated list, for
 * example "Fintech, Energy, Retail". A single industry is stored as plain text,
 * so every reader must split before comparing and every writer must join.
 * Nothing else in the codebase may split or join this column by hand.
 */

/** The most industries one company may hold; the admin basics API enforces the same cap. */
export const INDUSTRY_MAX = 8;

/** Trimmed, de-duplicated items of a stored industry list; empty items are dropped. */
export function splitIndustries(value: string | null | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const raw of value.split(",")) {
    const item = raw.trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

/** The stored form of a list of industries: trimmed, de-duplicated, comma separated. */
export function joinIndustries(values: readonly string[]): string {
  return splitIndustries(values.join(",")).join(", ");
}
