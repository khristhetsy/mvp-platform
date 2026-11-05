"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OnePagerShell } from "@/components/marketing/OnePagerShell";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { toSymbol } from "@/lib/investor/private-market";
import type { ListedCompany } from "@/lib/listing/private-market";
import { bandKeyForScore } from "@/lib/marketplace/readiness-board";

const BAND_LABEL = { strong: "Strong band", moderate: "Moderate band", building: "Building band" } as const;

/**
 * Signed in Private Market listings: every diligence complete company that opted in.
 * A row opens the company one pager (listing summary only, never documents).
 */
export function PrivateMarketListings({ companies }: Readonly<{ companies: ListedCompany[] }>) {
  const [selected, setSelected] = useState<ListedCompany | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[var(--blue-muted)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--navy)]">Live listings</h3>
          <span className="font-mono text-[11px] text-slate-600">{companies.length} LISTED · OPTED IN</span>
        </div>

        {companies.length === 0 ? (
          <div className="flex flex-col gap-2 px-6 py-7">
            <p className="text-lg font-semibold text-[var(--navy)]">First listings are in review.</p>
            <p className="text-sm leading-6 text-slate-600">
              A company appears here once its diligence checks are complete and the founder opts in.
            </p>
          </div>
        ) : (
          <ul>
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  aria-label={`Open one pager for ${c.name}`}
                  className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[var(--navy)]">{c.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      {[toSymbol(c.name), c.industry, c.stage].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[13px] font-semibold text-[var(--navy)]">
                    {c.raising?.replace(/^Raising\s+/i, "") ?? "Not provided"}
                    <div className="text-[9.5px] font-normal tracking-[0.08em] text-slate-500">RAISING</div>
                  </div>
                  <div className="text-right font-mono text-[15px] font-semibold text-[var(--blue)]">
                    {c.crr === null ? "n/a" : Math.round(c.crr)}
                    <div className="text-[9.5px] font-normal tracking-[0.08em] text-slate-500">CRR</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-100 px-5 py-3 font-mono text-[10px] leading-relaxed text-slate-500">
          Select a row to open its company one pager. Signed in investors and admins only.
        </p>
      </div>

      {selected ? <PrivateMarketOnePager company={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function PrivateMarketOnePager({ company, onClose }: Readonly<{ company: ListedCompany; onClose: () => void }>) {
  const facts: { label: string; value: string | null }[] = [
    { label: "Raising", value: company.raising?.replace(/^Raising\s+/i, "") ?? null },
    { label: "Stage", value: company.stage },
    { label: "Sector", value: company.industry },
    { label: "Location", value: company.location },
  ];
  const band = company.crr === null ? null : BAND_LABEL[bandKeyForScore(company.crr)];

  return (
    <OnePagerShell
      ariaLabel={`${company.name} one pager`}
      eyebrow="Company one pager"
      title={company.name}
      subtitle={toSymbol(company.name)}
      tags={[company.industry, company.stage, company.location].filter((t): t is string => Boolean(t))}
      onClose={onClose}
    >
      <div className="flex items-center gap-4">
        <ScoreRing
          score={company.crr}
          size={88}
          title={company.crr === null ? "Not scored" : `Readiness ${Math.round(company.crr)} out of 100`}
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">CRR</p>
          <p className="text-sm font-semibold text-[var(--navy)]">Readiness signal</p>
          {band ? <p className="font-mono text-[11px] text-[var(--teal)]">{band}</p> : null}
        </div>
      </div>

      {company.description ? <p className="text-sm leading-6 text-slate-600">{company.description}</p> : null}

      <dl className="grid grid-cols-2 gap-2.5">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{f.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--navy)]">{f.value ?? "Not provided"}</dd>
          </div>
        ))}
      </dl>

      <Link
        href={`/investor/opportunities?company=${company.id}`}
        className="cap-btn-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold"
      >
        Request introduction
        <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </Link>

      <p className="font-mono text-[10px] leading-relaxed text-slate-500">
        Listing summary only: no documents and no score breakdown. Informational only, not an investment recommendation.
      </p>
    </OnePagerShell>
  );
}
