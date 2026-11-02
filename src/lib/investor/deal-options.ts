/** Option lists for the investor "Your deals" form. Shared by the form and the API so both accept the same values. */

export const DEAL_AMOUNT_BANDS = [
  "Under $100K",
  "$100K to $500K",
  "$500K to $1M",
  "$1M to $5M",
  "$5M to $10M",
  "Over $10M",
] as const;

export function dealYearOptions(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  return Array.from({ length: current - 1989 }, (_, i) => current - i);
}

export function isDealAmountBand(v: unknown): v is (typeof DEAL_AMOUNT_BANDS)[number] {
  return typeof v === "string" && (DEAL_AMOUNT_BANDS as readonly string[]).includes(v);
}
