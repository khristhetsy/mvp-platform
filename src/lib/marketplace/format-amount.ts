/**
 * Format a raise range for tombstone cards: `$250K – $1.2M` (en dash, K/M
 * abbreviation). Handles equal min/max, missing max, and missing min.
 */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    // 1 decimal, but drop a trailing .0 → "$2M" not "$2.0M"
    return `$${(Math.round(m * 10) / 10).toString()}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1_000)}K`;
  }
  return `$${Math.round(n)}`;
}

export function formatAmountRange(min: number | null | undefined, max: number | null | undefined): string {
  const hasMin = typeof min === "number" && Number.isFinite(min);
  const hasMax = typeof max === "number" && Number.isFinite(max);

  if (hasMin && hasMax) {
    if (min === max) return formatAmount(min as number);
    return `${formatAmount(min as number)} – ${formatAmount(max as number)}`;
  }
  if (hasMin) return `${formatAmount(min as number)}+`;
  if (hasMax) return `Up to ${formatAmount(max as number)}`;
  return "—";
}
