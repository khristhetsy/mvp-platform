"use client";

import { useState } from "react";
import { CapitalReadyBadge } from "@/components/CapitalReadyBadge";
import { LiveDealOnePagerDrawer } from "@/components/marketing/LiveDealOnePagerDrawer";
import type { LiveBoardRow } from "@/lib/marketplace/live-board";

const COLS = "sm:grid-cols-[1.6fr_0.9fr_0.9fr_1fr_0.8fr]";

/** Live, admin-approved listings as a board. Selecting a row opens its company one pager. */
export function LiveDealsBoard({ rows }: Readonly<{ rows: LiveBoardRow[] }>) {
  const [selected, setSelected] = useState<LiveBoardRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <div className={`hidden gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-500 sm:grid ${COLS}`}>
          <div>Symbol</div>
          <div>Industry</div>
          <div>Stage</div>
          <div className="text-right">Target</div>
          <div className="text-right">Minimum</div>
        </div>
        {rows.map((r) => (
          <button
            key={r.slug}
            type="button"
            onClick={() => setSelected(r)}
            aria-label={`Open one pager for ${r.name}`}
            className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue)] sm:grid ${COLS}`}
          >
            <div className="min-w-0">
              <div className="font-mono text-[13px] font-semibold text-[var(--navy)]">{r.symbol}</div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                <span className="truncate">{r.name}</span>
                {r.capitalReady ? <CapitalReadyBadge /> : null}
              </div>
            </div>
            <div className="hidden text-[13px] text-slate-700 sm:block">{r.industry ?? "Private company"}</div>
            <div className="hidden text-[13px] text-slate-700 sm:block">{r.stage ?? "Not provided"}</div>
            <div className="text-right font-mono text-[13px] font-semibold text-[var(--navy)]">{r.target ?? "Not provided"}</div>
            <div className="hidden text-right font-mono text-[13px] text-slate-700 sm:block">{r.minimum ?? "Not provided"}</div>
          </button>
        ))}
      </div>
      <LiveDealOnePagerDrawer deal={selected} onClose={() => setSelected(null)} />
    </>
  );
}
