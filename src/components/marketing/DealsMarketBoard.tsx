"use client";

import { useState } from "react";
import { MarketingScoredBoard } from "@/components/marketing/MarketingScoredBoard";
import { DealOnePagerDrawer } from "@/components/marketing/DealOnePagerDrawer";
import { SAMPLE_DEALS, sectorAverages, type SampleDeal } from "@/lib/marketplace/sample-board";

/**
 * The deals board with its click-through one pager, plus a sector strip computed
 * from the same sample rows. Sample data throughout, labelled as such.
 */
export function DealsMarketBoard({ title }: Readonly<{ title: string }>) {
  const [selected, setSelected] = useState<SampleDeal | null>(null);
  const sectors = sectorAverages(SAMPLE_DEALS);

  return (
    <>
      <MarketingScoredBoard
        title={title}
        meta="4 deals · ranked by readiness · select a row for its one pager"
        scoreLabel="Readiness"
        metricLabel="Indicated"
        rows={SAMPLE_DEALS}
        note="Illustrative"
        bare
        onSelectRow={(row) => setSelected(SAMPLE_DEALS.find((d) => d.symbol === row.symbol) ?? null)}
      />

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">Sector board · average readiness</p>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {sectors.map((s) => (
            <li key={s.sector} className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{s.sector}</p>
              <p className="mt-1 font-mono text-[19px] font-semibold leading-none text-[var(--navy)]">{s.avgScore.toFixed(1)}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                {s.deals} {s.deals === 1 ? "deal" : "deals"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <DealOnePagerDrawer deal={selected} onClose={() => setSelected(null)} />
    </>
  );
}
