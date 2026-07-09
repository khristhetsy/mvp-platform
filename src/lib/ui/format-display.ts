export function formatOperationalNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

/**
 * Canonical money formatter. Consolidates the `Intl.NumberFormat("en-US", { style:
 * "currency", currency: "USD", maximumFractionDigits: 0 })` idiom that was copy-pasted
 * across the app (audit H8). Pass `cents: true` for integer-cent inputs.
 */
export function formatCurrency(
  value: number,
  opts: { currency?: string; cents?: boolean; maximumFractionDigits?: number } = {},
): string {
  const { currency = "USD", cents = false, maximumFractionDigits = 0 } = opts;
  const amount = cents ? value / 100 : value;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString()}`;
  }
}

/** Whole-dollar USD — the most common shape (`$1,234`). */
export function formatUsd(value: number): string {
  return formatCurrency(value);
}

/** Compact number, e.g. 12.4K / 3.1M. */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatLastUpdated(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
