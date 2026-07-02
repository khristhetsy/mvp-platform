"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronRight, LayoutGrid, Flame } from "lucide-react";
import type { ReadinessTrend } from "@/lib/investor/metric-trends";
import {
  readinessBand,
  type PrivateMarketDeal,
} from "@/lib/investor/private-market";

function Sparkline({ trend }: { trend?: ReadinessTrend | null }) {
  const t = useTranslations("investorCmp");
  const pts = trend?.sparkline ?? [];
  if (pts.length < 2 || trend?.delta == null) {
    return (
      <span className="font-mono text-xs text-slate-300" title={t("trend_builds_as_daily_snapshots_accrue")}>
        —
      </span>
    );
  }
  const w = 46;
  const h = 16;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = w / (pts.length - 1);
  const coords = pts
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  const down = trend.direction === "down";
  const color = down ? "#A32D2D" : "var(--teal)";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
        <polyline points={coords} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-mono text-[11px] font-semibold" style={{ color }}>
        {down ? "▼" : "▲"} {Math.abs(trend.delta).toFixed(1)}
      </span>
    </div>
  );
}

type SortBy = "match" | "readiness" | "fill";

const SORTS: { key: SortBy; label: string }[] = [
  { key: "match", label: "Match" },
  { key: "readiness", label: "Readiness" },
  { key: "fill", label: "Filling" },
];

function compactMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

const BAND_STYLE: Record<string, { sigil: string; price: string }> = {
  high: { sigil: "bg-[var(--teal-muted)] text-[var(--teal)]", price: "text-[var(--teal)]" },
  mid: { sigil: "bg-[var(--blue-muted)] text-[var(--blue)]", price: "text-[var(--navy)]" },
  low: { sigil: "bg-slate-100 text-slate-400", price: "text-slate-600" },
  none: { sigil: "bg-slate-100 text-slate-400", price: "text-slate-500" },
};

function dealHref(deal: PrivateMarketDeal) {
  return deal.slug
    ? `/deals/${deal.slug}`
    : `/investor/opportunities/${deal.companyId}/report`;
}

export function InvestorPrivateMarketBoard({
  deals,
}: Readonly<{ deals: PrivateMarketDeal[] }>) {
  const t = useTranslations("investorCmp");
  const [sortBy, setSortBy] = useState<SortBy>("match");

  const sorted = useMemo(() => {
    const bySymbol = (a: PrivateMarketDeal, b: PrivateMarketDeal) => a.symbol.localeCompare(b.symbol);
    return [...deals].sort((a, b) => {
      if (sortBy === "readiness") {
        return (
          (b.readinessScore ?? 0) - (a.readinessScore ?? 0) ||
          b.matchScore - a.matchScore ||
          bySymbol(a, b)
        );
      }
      if (sortBy === "fill") {
        return (
          (b.fillPct ?? -1) - (a.fillPct ?? -1) ||
          b.totalIndicated - a.totalIndicated ||
          bySymbol(a, b)
        );
      }
      return (
        b.matchScore - a.matchScore ||
        (b.readinessScore ?? 0) - (a.readinessScore ?? 0) ||
        bySymbol(a, b)
      );
    });
  }, [deals, sortBy]);

  if (deals.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No marketplace listings match your thesis yet. Complete investor onboarding to
        improve match quality, or browse the full marketplace.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] font-mono text-[11px] font-semibold text-white">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">{t("deals")}</h2>
            <p className="font-mono text-[11px] text-slate-400">
              {deals.length} diligence-ready · ranked to your thesis
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortBy(s.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === s.key
                  ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]"
                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="hidden grid-cols-[1.7fr_0.9fr_0.6fr_0.8fr_1.2fr_0.8fr_24px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400 md:grid">
        <div>{t("symbol")}</div>
        <div className="text-right">{t("readiness")}</div>
        <div className="text-right">{t("trend")}</div>
        <div className="text-right">{t("your_match")}</div>
        <div>{t("indicated_interest")}</div>
        <div>{t("sector")}</div>
        <div />
      </div>

      {/* rows */}
      <div>
        {sorted.map((deal) => {
          const band = readinessBand(deal.readinessScore);
          const style = BAND_STYLE[band.key];
          return (
            <Link
              key={deal.companyId}
              href={dealHref(deal)}
              className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] md:grid-cols-[1.7fr_0.9fr_0.6fr_0.8fr_1.2fr_0.8fr_24px]"
            >
              {/* symbol */}
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold ${style.sigil}`}
                >
                  {deal.symbol.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[13px] font-semibold text-[var(--navy)]">
                      {deal.symbol}
                    </span>
                    {deal.fillingFast ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--teal-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--teal)]" title={t("indicated_interest_growing_fast")}>
                        <Flame className="h-2.5 w-2.5" /> Fast
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11.5px] text-slate-400">
                    {deal.companyName}
                  </div>
                </div>
              </div>

              {/* readiness */}
              <div className="hidden text-right md:block">
                <div className={`font-mono text-[19px] font-semibold leading-none ${style.price}`}>
                  {deal.readinessScore != null ? deal.readinessScore.toFixed(1) : "—"}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">
                  {band.label}
                </div>
              </div>

              {/* trend — real sparkline once snapshots accrue, else "—" */}
              <div className="hidden justify-items-end md:grid">
                <Sparkline trend={deal.trend} />
              </div>

              {/* match */}
              <div className="hidden text-right md:block">
                <div className="font-mono text-[15px] font-semibold text-[var(--indigo)]">
                  {deal.matchScore}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
                  match
                </div>
              </div>

              {/* fill */}
              <div className="col-span-2 mt-3 md:col-span-1 md:mt-0">
                {deal.fillPct != null ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[var(--teal)]"
                        style={{ width: `${deal.fillPct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-600">
                        {deal.fillPct}% indicated
                      </span>
                      <span>
                        {compactMoney(deal.totalIndicated, deal.currency)}
                        {deal.fundingTarget != null
                          ? ` / ${compactMoney(deal.fundingTarget, deal.currency)}`
                          : ""}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="font-mono text-[11px] text-slate-300">
                    no target set
                  </span>
                )}
              </div>

              {/* sector */}
              <div className="hidden flex-wrap gap-1.5 md:flex">
                {deal.industry ? (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {deal.industry}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-slate-300">—</span>
                )}
              </div>

              {/* caret */}
              <ChevronRight className="hidden h-[18px] w-[18px] justify-self-end text-slate-300 transition-colors group-hover:text-[var(--indigo)] md:block" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
