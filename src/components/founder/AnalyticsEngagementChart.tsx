"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EngagementTrendResult, EngagementWeek } from "@/app/api/founder/analytics/engagement-trend/route";

type Series = { key: keyof Omit<EngagementWeek, "label" | "weekStart">; label: string; color: string };

const SERIES: Series[] = [
  { key: "viewed",          label: "Views",     color: "#6366f1" },
  { key: "saved",           label: "Saves",     color: "#3b82f6" },
  { key: "interested",      label: "Interests", color: "#f59e0b" },
  { key: "intro_requested", label: "Intros",    color: "#10b981" },
];

const BAR_W = 8;     // width per series bar
const BAR_GAP = 2;   // gap between series bars
const GROUP_GAP = 16;// gap between week groups
const CHART_H = 120; // chart area height

export function AnalyticsEngagementChart() {
  const t = useTranslations("founderCmp");
  const [data, setData] = useState<EngagementWeek[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/founder/analytics/engagement-trend")
      .then((r) => r.json())
      .then((d: EngagementTrendResult) => {
        setData(d.weeks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">{t("engagement_trend")}</p>
          <p className="mt-0.5 text-xs text-slate-500">8-week investor interaction history</p>
        </div>
        <div className="h-[160px] animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const allValues = data.flatMap((w) => SERIES.map((s) => w[s.key]));
  const maxVal = Math.max(1, ...allValues);

  const groupW = SERIES.length * (BAR_W + BAR_GAP) - BAR_GAP + GROUP_GAP;
  const svgW = data.length * groupW - GROUP_GAP;
  const svgH = CHART_H + 24; // extra for labels

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t("engagement_trend")}</p>
          <p className="mt-0.5 text-xs text-slate-500">8-week investor interaction history</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="text-[10px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          className="min-w-full"
        >
          {data.map((week, wi) => {
            const groupX = wi * groupW;
            return (
              <g key={week.weekStart}>
                {SERIES.map((s, si) => {
                  const val = week[s.key];
                  const barH = val === 0 ? 2 : Math.max(4, (val / maxVal) * CHART_H);
                  const x = groupX + si * (BAR_W + BAR_GAP);
                  const y = CHART_H - barH;
                  return (
                    <g key={s.key}>
                      <rect
                        x={x}
                        y={y}
                        width={BAR_W}
                        height={barH}
                        rx={2}
                        fill={val === 0 ? "#e2e8f0" : s.color}
                        opacity={val === 0 ? 0.5 : 0.85}
                      />
                      {val > 0 && (
                        <title>{`${s.label}: ${val}`}</title>
                      )}
                    </g>
                  );
                })}
                {/* Week label */}
                <text
                  x={groupX + (SERIES.length * (BAR_W + BAR_GAP)) / 2 - BAR_GAP / 2}
                  y={CHART_H + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94a3b8"
                >
                  {week.label}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          <line
            x1={0}
            y1={CHART_H}
            x2={svgW}
            y2={CHART_H}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        </svg>
      </div>

      {/* Total summary */}
      <div className="grid grid-cols-4 gap-px border-t border-slate-100 bg-slate-100">
        {SERIES.map((s) => {
          const total = data.reduce((sum, w) => sum + w[s.key], 0);
          return (
            <div key={s.key} className="bg-white px-4 py-2.5 text-center">
              <p className="text-lg font-bold text-slate-900">{total}</p>
              <p className="mt-0.5 text-[10px] font-medium" style={{ color: s.color }}>
                {s.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
