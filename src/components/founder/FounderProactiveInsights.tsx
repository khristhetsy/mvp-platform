"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  computeFounderInsights,
  type InsightLevel,
  type FounderInsight,
} from "@/lib/insights/compute-founder-insights";

/* ─────────────────────────── styles ─────────────────────────── */

const LEVEL_STYLES: Record<
  InsightLevel,
  { borderColor: string; bg: string; badge: string; badgeText: string; badgeLabel: string }
> = {
  critical: {
    borderColor: "#dc2626",
    bg: "#fff9f9",
    badge: "#FCEBEB",
    badgeText: "#A32D2D",
    badgeLabel: "URGENT",
  },
  warning: {
    borderColor: "#f59e0b",
    bg: "#fffdf7",
    badge: "#FAEEDA",
    badgeText: "#854F0B",
    badgeLabel: "ACTION",
  },
  opportunity: {
    borderColor: "#2E78F5",
    bg: "#fafaff",
    badge: "#EEEDFE",
    badgeText: "#1A6CE4",
    badgeLabel: "OPPORTUNITY",
  },
  positive: {
    borderColor: "#22c55e",
    bg: "#f9fef9",
    badge: "#EAF3DE",
    badgeText: "#1E6D3C",
    badgeLabel: "ON TRACK",
  },
};

/* ─────────────────────────── props ──────────────────────────── */

type Room = { id: string; title: string; status: string; updated_at: string };

type Props = Readonly<{
  rooms: Room[];
  unresolvedQCount: number;
  readinessScore: number;
  strongMatchCount: number;
}>;

/* ─────────────────────────── component ─────────────────────── */

export function FounderProactiveInsights({
  rooms,
  unresolvedQCount,
  readinessScore,
  strongMatchCount,
}: Props) {
  const t = useTranslations("founderCmp");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const allInsights = computeFounderInsights({
    rooms,
    unresolvedQCount,
    readinessScore,
    strongMatchCount,
  });

  const visible = allInsights.filter((i) => !dismissed.has(i.id));

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  if (visible.length === 0) return null;

  const urgentCount = visible.filter((i) => i.level === "critical" || i.level === "warning").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#2E78F5,#7c3aed)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Sparkle icon */}
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "#EEEDFE" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
                  stroke="#2E78F5" strokeWidth="2" strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">{t("capital_intelligence")}</p>
            {urgentCount > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "#FCEBEB", color: "#A32D2D" }}
              >
                {urgentCount} need{urgentCount === 1 ? "s" : ""} attention
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "#EAF3DE", color: "#1E6D3C" }}
              >
                All clear
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {visible.length} insight{visible.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Insight cards */}
        <div className="space-y-3">
          {visible.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── insight card ───────────────────── */

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: FounderInsight;
  onDismiss: (id: string) => void;
}) {
  const s = LEVEL_STYLES[insight.level];

  return (
    <div
      className="flex gap-3 rounded-lg p-3.5"
      style={{
        background: s.bg,
        borderLeft: `3px solid ${s.borderColor}`,
        border: `1px solid ${s.borderColor}20`,
        borderLeftWidth: 3,
        borderLeftColor: s.borderColor,
      }}
    >
      <div className="min-w-0 flex-1">
        {/* Level badge + age */}
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.08em]"
            style={{ background: s.badge, color: s.badgeText }}
          >
            {s.badgeLabel}
          </span>
          {insight.age ? (
            <span className="text-[10px] font-semibold text-slate-400">{insight.age}</span>
          ) : null}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-slate-900">{insight.title}</p>

        {/* Body */}
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{insight.body}</p>

        {/* CTA */}
        {insight.cta ? (
          <Link
            href={insight.cta.href}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: s.borderColor }}
          >
            {insight.cta.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(insight.id)}
        aria-label="Dismiss insight"
        className="shrink-0 self-start rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
