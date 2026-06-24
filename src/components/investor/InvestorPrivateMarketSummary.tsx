import { LayoutGrid, Wallet, Gauge } from "lucide-react";
import type { PrivateMarketSummary } from "@/lib/investor/private-market";

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

/** Three-card at-a-glance strip above the Private Market board. All values are real. */
export function InvestorPrivateMarketSummary({
  summary,
  currency = "USD",
}: Readonly<{ summary: PrivateMarketSummary; currency?: string }>) {
  const cards = [
    {
      icon: LayoutGrid,
      label: "Matched to thesis",
      value: String(summary.matchedCount),
      sub: "diligence-ready deals",
      tint: "var(--indigo)",
      bg: "var(--indigo-soft)",
    },
    {
      icon: Wallet,
      label: "Your indicated · 30d",
      value: money(summary.indicated30d, currency),
      sub:
        summary.indicated30dCount > 0
          ? `across ${summary.indicated30dCount} deal${summary.indicated30dCount === 1 ? "" : "s"} · non-binding`
          : "non-binding indications",
      tint: "var(--teal)",
      bg: "var(--teal-muted)",
    },
    {
      icon: Gauge,
      label: "Avg readiness",
      value: summary.avgReadiness != null ? summary.avgReadiness.toFixed(1) : "—",
      sub: "across matched deals",
      tint: "var(--navy)",
      bg: "var(--navy-muted)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: c.bg, color: c.tint }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {c.label}
              </span>
            </div>
            <div className="mt-2 font-mono text-[22px] font-semibold text-slate-900">
              {c.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{c.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
