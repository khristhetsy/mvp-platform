import type { TrendPoint, TrendSeries } from "@/lib/analytics/types";

export function clampTrendWindowDays(value: string | null | undefined): 7 | 30 | 90 {
  const n = Number(value);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatCurrencyAmount(amount: number, currency = "USD"): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function normalizeSeriesTotals(series: TrendSeries[]): TrendSeries[] {
  return series.map((s) => ({
    ...s,
    total: s.points.reduce((sum, p) => sum + (Number(p.value) || 0), 0),
  }));
}

export function maxTrendValue(points: TrendPoint[]): number {
  return points.reduce((max, p) => Math.max(max, p.value), 0);
}

