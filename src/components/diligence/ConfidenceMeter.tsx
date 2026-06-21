"use client";

import { DD_COLORS } from "@/lib/diligence/types";

export function ConfidenceMeter({ pct }: { pct: number }) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  const color = value >= 70 ? DD_COLORS.verified : value >= 40 ? DD_COLORS.med : DD_COLORS.high;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div style={{ width: `${value}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}
