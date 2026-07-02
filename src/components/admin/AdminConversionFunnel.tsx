"use client";

import { useTranslations } from "next-intl";
export type FunnelStage = {
  label: string;
  count: number;
  href?: string;
  description?: string;
};

function conversionRate(from: number, to: number): string {
  if (!from || !to) return "";
  const pct = Math.round((to / from) * 100);
  return `${pct}%`;
}

const STAGE_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-sky-500",
  "bg-emerald-500",
];

export function AdminConversionFunnel({ stages }: Readonly<{ stages: FunnelStage[] }>) {
  const t = useTranslations("adminCmp");
  if (stages.length === 0) return null;

  const maxCount = Math.max(1, stages[0]?.count ?? 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const barPct = Math.max(4, Math.round((stage.count / maxCount) * 100));
        const convRate = i > 0 ? conversionRate(stages[i - 1]?.count ?? 0, stage.count) : null;
        const colorCls = STAGE_COLORS[i % STAGE_COLORS.length];

        return (
          <div key={stage.label} className="flex items-center gap-3 text-sm">
            {/* Stage label */}
            <div className="w-44 shrink-0">
              {stage.href ? (
                <a
                  href={stage.href}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {stage.label}
                </a>
              ) : (
                <span className="font-medium text-slate-700">{stage.label}</span>
              )}
              {stage.description && (
                <p className="mt-0.5 text-[10px] text-slate-400">{stage.description}</p>
              )}
            </div>

            {/* Bar */}
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-4">
              <div
                className={`h-full rounded-full transition-all ${colorCls}`}
                style={{ width: `${barPct}%` }}
              />
            </div>

            {/* Count */}
            <div className="w-16 shrink-0 text-right font-semibold text-slate-900 tabular-nums">
              {stage.count.toLocaleString()}
            </div>

            {/* Conversion rate from prior stage */}
            <div className="w-12 shrink-0 text-right text-xs text-slate-400 tabular-nums">
              {convRate ?? ""}
            </div>
          </div>
        );
      })}

      {/* Legend header */}
      <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <div className="w-44 shrink-0" />
        <div className="flex-1" />
        <div className="w-16 shrink-0 text-right">{t("count")}</div>
        <div className="w-12 shrink-0 text-right">{t("conv")}</div>
      </div>
    </div>
  );
}
