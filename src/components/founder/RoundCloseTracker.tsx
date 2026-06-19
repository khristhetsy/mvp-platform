"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RoundCloseStats } from "@/app/api/founder/round-close-stats/route";

function formatCurrency(amount: number, currency = "USD"): string {
  if (amount >= 1_000_000)
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000)
    return `$${(amount / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STAGE_LABELS: Record<string, string> = {
  not_started: "Not started",
  contacted: "Contacted",
  in_progress: "In progress",
  closed: "Closed",
};

const STAGE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  not_started: { bg: "#F8FAFC", text: "#64748b", bar: "#CBD5E1" },
  contacted:   { bg: "#EFF6FF", text: "#1D4ED8", bar: "#93C5FD" },
  in_progress: { bg: "#FDF4FF", text: "#7E22CE", bar: "#C084FC" },
  closed:      { bg: "#F0FDF4", text: "#15803D", bar: "#4ADE80" },
};

function Skeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-slate-100" />
      <div className="mb-2 h-3 w-full animate-pulse rounded-full bg-slate-100" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function RoundCloseTracker() {
  const [stats, setStats] = useState<RoundCloseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/founder/round-close-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RoundCloseStats | null) => {
        if (data) setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!stats) return null;

  const hasTarget = Boolean(stats.fundingTarget && stats.fundingTarget > 0);
  const hasPipeline = stats.totalPipeline > 0;

  // Don't render if there's nothing to show yet
  if (!hasTarget && !hasPipeline && stats.totalPledged === 0) return null;

  const pipelineStages: (keyof typeof stats.pipeline)[] = [
    "not_started",
    "contacted",
    "in_progress",
    "closed",
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Round close tracker</h2>
          {hasTarget ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {stats.fillPct}% of{" "}
              {formatCurrency(stats.fundingTarget!, stats.currency)} target pledged
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              Set a funding target in{" "}
              <Link href="/founder/settings" className="font-medium text-indigo-600 hover:underline">
                company settings
              </Link>{" "}
              to track your close.
            </p>
          )}
        </div>
        <Link
          href="/founder/capital-raise"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition"
        >
          Full overview →
        </Link>
      </div>

      {/* Thermometer */}
      {hasTarget && (
        <div className="mb-5">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stats.fillPct}%`,
                background:
                  stats.fillPct >= 75
                    ? "linear-gradient(90deg,#16a34a,#4ade80)"
                    : stats.fillPct >= 40
                    ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                    : "linear-gradient(90deg,#4338ca,#818cf8)",
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold" style={{ color: stats.fillPct >= 75 ? "#15803d" : "#4338ca" }}>
              {formatCurrency(stats.totalPledged, stats.currency)} pledged
            </span>
            <span className="text-slate-400">
              {stats.investorCount} investor{stats.investorCount !== 1 ? "s" : ""}
              {stats.pendingIntros > 0 && (
                <> · <span className="text-amber-600 font-medium">{stats.pendingIntros} intro{stats.pendingIntros !== 1 ? "s" : ""} pending</span></>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Pipeline stage breakdown */}
      {hasPipeline && (
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Outreach pipeline — {stats.totalPipeline} investor{stats.totalPipeline !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pipelineStages.map((stage) => {
              const count = stats.pipeline[stage];
              const pct = stats.totalPipeline > 0
                ? Math.round((count / stats.totalPipeline) * 100)
                : 0;
              const c = STAGE_COLORS[stage];
              return (
                <div
                  key={stage}
                  style={{ background: c.bg }}
                  className="rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: c.text }}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: c.text }}>
                      {count}
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div className="h-1 w-full rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: c.bar }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {stats.interestedCount > 0 && (
            <p className="mt-2.5 text-[11px] text-slate-500">
              <span className="font-semibold text-amber-700">{stats.interestedCount}</span>{" "}
              investor{stats.interestedCount !== 1 ? "s" : ""} marked interested ·{" "}
              <Link href="/founder/investor-pipeline" className="font-medium text-indigo-600 hover:underline">
                View pipeline →
              </Link>
            </p>
          )}
        </div>
      )}

      {!hasPipeline && (
        <div className="mt-1 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">
            Add investors to your{" "}
            <Link href="/founder/investor-pipeline" className="font-medium text-indigo-600 hover:underline">
              pipeline
            </Link>{" "}
            to track outreach progress here.
          </p>
        </div>
      )}
    </div>
  );
}
