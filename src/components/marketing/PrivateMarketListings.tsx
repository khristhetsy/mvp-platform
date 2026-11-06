"use client";

import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { toSymbol } from "@/lib/investor/private-market";
import type { ListedCompany } from "@/lib/listing/private-market";
import { ARROW, directionOf, signed, type Direction } from "@/lib/marketplace/market-board";
import { useDismiss } from "@/lib/ui/use-dismiss";

export type ListingBoardStats = {
  /** CRR change since the company's first reading, or null with fewer than two readings. */
  crrChange: number | null;
  firstAt: string | null;
  outreachTotal: number;
  outreachChange: number;
  /** The signed in investor's match percent, or null when there is no investor profile. */
  match: number | null;
};

const REVENUE_LABEL: Record<string, string> = {
  pre_revenue: "Pre-revenue",
  early_revenue: "Early revenue",
  growing: "Growing",
  scaling: "Scaling",
};
const TONE: Record<Direction, string> = { up: "text-[#0f7a54]", down: "text-[#d92d20]", flat: "text-slate-500" };
const COLS = "lg:grid-cols-[80px_2fr_1fr_0.7fr_1fr_0.7fr_0.8fr_1fr_0.8fr]";

const revenueLabel = (c: ListedCompany) => (c.revenueStage ? (REVENUE_LABEL[c.revenueStage] ?? c.revenueStage) : null);
const seeking = (c: ListedCompany) => c.raising?.replace(/^Raising\s+/i, "") ?? null;
const dayMonth = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

function Cell({ label, className = "", children }: Readonly<{ label: string; className?: string; children: ReactNode }>) {
  return (
    <span className={`min-w-0 ${className}`}>
      <span className="mb-0.5 block font-mono text-[9px] tracking-[0.1em] text-slate-500 lg:hidden">{label}</span>
      {children}
    </span>
  );
}

/**
 * Signed in Private Market table: every approved company, with its CRR
 * and outreach. A row opens a centered company one pager (listing summary only,
 * never documents). Rows become cards below the large breakpoint.
 */
export function PrivateMarketListings({
  companies,
  stats,
  selected,
  onSelect,
  canRequest,
  sector,
  onClearSector,
  approvedCount,
  optedInCount,
  outreachWindowDays,
}: Readonly<{
  companies: ListedCompany[];
  stats: Record<string, ListingBoardStats>;
  selected: ListedCompany | null;
  onSelect: (id: string | null) => void;
  canRequest: boolean;
  sector: string | null;
  onClearSector: () => void;
  approvedCount: number;
  optedInCount: number;
  outreachWindowDays: number;
}>) {
  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[var(--blue-muted)] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-[var(--navy)]">Approved companies</h2>
          <span className="font-mono text-[11px] text-slate-600">
            {approvedCount} APPROVED · {optedInCount} OPTED IN
          </span>
        </div>

        {sector ? (
          <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[var(--blue-border)] bg-[var(--blue-muted)] px-5 py-3 font-mono text-xs text-[var(--navy)]">
            <span>
              SHOWING {sector.toUpperCase()} ONLY · {companies.length} {companies.length === 1 ? "COMPANY" : "COMPANIES"}
            </span>
            <button
              type="button"
              onClick={onClearSector}
              className="min-h-9 rounded-lg border border-[var(--blue)] bg-white px-3.5 font-mono text-xs font-semibold text-[var(--blue)]"
            >
              Show all sectors
            </button>
          </div>
        ) : null}

        {companies.length === 0 ? (
          <div className="flex flex-col gap-2 px-6 py-7">
            <p className="text-lg font-semibold text-[var(--navy)]">
              {sector ? "No approved companies in this sector yet." : "First companies are in review."}
            </p>
            {sector ? null : <p className="text-sm leading-6 text-slate-600">A company appears here once iCapOS approves it.</p>}
          </div>
        ) : (
          <div>
            <div className={`hidden items-center gap-3 border-b border-slate-200 bg-[#f3f7ff] px-5 py-2.5 font-mono text-[10.5px] tracking-[0.1em] text-slate-600 lg:grid ${COLS}`}>
              {["SYMBOL", "COMPANY", "INDUSTRY", "STAGE", "SEEKING", "CRR", "CHG", "OUTREACH", "YOUR MATCH"].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {companies.map((c) => {
              const s = stats[c.id];
              const chg = s?.crrChange ?? null;
              const chgDir = directionOf(chg ?? 0);
              const outDir = directionOf(s?.outreachChange ?? 0);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-label={`Open one pager for ${c.name}`}
                  className={`grid w-full grid-cols-2 items-start gap-x-4 gap-y-2.5 border-b border-slate-100 px-4 py-4 text-left text-[13px] transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue)] lg:items-center lg:gap-3 lg:px-5 lg:py-3.5 ${COLS}`}
                >
                  <span className="col-span-2 font-mono font-semibold text-[var(--blue)] lg:col-span-1">{toSymbol(c.name)}</span>
                  <span className="col-span-2 min-w-0 lg:col-span-1">
                    <span className="block font-semibold text-[var(--navy)] lg:truncate">{c.name}</span>
                    <span className={`font-mono text-[9px] tracking-[0.08em] ${c.optedIn ? "text-[#0f7a54]" : "text-slate-500"}`}>
                      {c.optedIn ? "OPTED IN" : "APPROVED · NOT OPTED IN"}
                    </span>
                  </span>
                  <Cell label="INDUSTRY" className="text-slate-600">{c.industry ?? "n/a"}</Cell>
                  <Cell label="STAGE" className="text-slate-600">{c.stage ?? "n/a"}</Cell>
                  <Cell label="SEEKING" className="font-mono font-semibold text-slate-700">{seeking(c) ?? "n/a"}</Cell>
                  <Cell label="CRR" className="font-mono text-[15px] font-semibold text-[var(--navy)]">{c.crr === null ? "n/a" : Math.round(c.crr)}</Cell>
                  <Cell label="CHG" className={`font-mono font-semibold ${TONE[chgDir]}`}>
                    {chg === null ? "n/a" : `${ARROW[chgDir]} ${chg === 0 ? "0" : signed(chg)}`}
                  </Cell>
                  <Cell label="OUTREACH" className="font-mono font-semibold text-[var(--navy)]">
                    {s ? s.outreachTotal : "n/a"}{" "}
                    {s ? <span className={TONE[outDir]}>{ARROW[outDir]}{outDir === "flat" ? "" : ` ${signed(s.outreachChange)}`}</span> : null}
                  </Cell>
                  <Cell label="YOUR MATCH" className="font-mono font-semibold text-[var(--blue)]">{s?.match == null ? "n/a" : `${s.match}%`}</Cell>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 px-5 py-3 font-mono text-[10.5px] text-slate-600">
          <span>Outreach: investor outreach messages sent, change over the last {outreachWindowDays} days.</span>
          <span><b className="text-[#0f7a54]">▲</b> increase</span>
          <span><b className="text-[#d92d20]">▼</b> decrease</span>
          <span><b className="text-slate-500">▬</b> no change</span>
          <span>Your match: fit with your investor profile, shown to investors only.</span>
        </div>
      </div>

      {selected ? (
        <CompanyOnePager company={selected} stats={stats[selected.id]} canRequest={canRequest} onClose={() => onSelect(null)} />
      ) : null}
    </>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-slate-200 bg-[#f3f7ff] p-3.5">
      <span className="font-mono text-[11px] tracking-[0.1em] text-slate-600">{label}</span>
      <span className="text-[15px] font-semibold text-[var(--navy)]">{value ?? "Not provided"}</span>
    </div>
  );
}

function Row({ label, value, last }: Readonly<{ label: string; value: string | null; last?: boolean }>) {
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3 ${last ? "" : "border-b border-slate-100"}`}>
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-mono font-semibold text-[var(--navy)]">{value ?? "Not provided"}</span>
    </div>
  );
}

function CompanyOnePager({
  company,
  stats,
  canRequest,
  onClose,
}: Readonly<{ company: ListedCompany; stats: ListingBoardStats | undefined; canRequest: boolean; onClose: () => void }>) {
  const ref = useDismiss<HTMLDivElement>(true, onClose);
  const symbol = toSymbol(company.name);
  const tags = [
    ...(company.industry?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
    revenueLabel(company),
    ...(company.location?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ].filter((t): t is string => Boolean(t));
  const chg = stats?.crrChange ?? null;
  const chgDir = directionOf(chg ?? 0);
  const introHref = `/investor/opportunities?company=${company.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={`${company.name} one pager`}>
      <div ref={ref} className="flex max-h-[calc(100vh-16px)] w-full max-w-[1040px] flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-40px)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <span className="font-mono text-[11px] tracking-[0.12em] text-slate-600">COMPANY ONE PAGER · {symbol}</span>
          <div className="flex items-center gap-2.5">
            {canRequest ? (
              <Link href={introHref} className="cap-btn-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold">
                Request introduction
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
            ) : (
              <span className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3 font-mono text-[11px] tracking-[0.08em] text-slate-600">
                INVESTORS ONLY · REQUEST INTRODUCTION
              </span>
            )}
            <button type="button" onClick={onClose} autoFocus aria-label="Close one pager" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 p-4 sm:p-6">
            <div className="flex min-w-0 flex-1 basis-72 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--blue-border)] bg-[var(--blue-muted)] font-mono text-[15px] font-semibold text-[var(--blue)]">
                {symbol.slice(0, 4)}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold leading-tight tracking-tight text-[var(--navy)] sm:text-2xl">{company.name}</h2>
                {tags.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span key={t} className="rounded-full bg-[var(--blue-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--blue)]">{t}</span>
                    ))}
                  </div>
                ) : null}
                <p className={`mt-2.5 font-mono text-[10px] font-semibold tracking-[0.1em] ${company.optedIn ? "text-[#0f7a54]" : "text-slate-500"}`}>
                  {company.optedIn ? "OPTED IN" : "APPROVED · NOT OPTED IN"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <ScoreRing score={company.crr} size={96} title={company.crr === null ? "Not scored" : `Readiness ${Math.round(company.crr)} out of 100`} />
              <div>
                <p className="font-mono text-xs tracking-[0.1em] text-slate-600">CRR</p>
                <p className="mt-1 text-base font-bold text-[var(--navy)]">Readiness signal</p>
                {chg !== null && stats?.firstAt ? (
                  <p className={`font-mono text-xs ${TONE[chgDir]}`}>
                    {ARROW[chgDir]} {chg === 0 ? "0" : signed(chg)} since {dayMonth(stats.firstAt)}
                  </p>
                ) : null}
                {canRequest ? (
                  <p className="mt-1.5 font-mono text-xs font-semibold text-[var(--blue)]">
                    YOUR MATCH {stats?.match == null ? "n/a" : `${stats.match}%`}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-[2_1_340px] rounded-xl border border-slate-200 p-4 sm:p-5">
              <h3 className="text-lg font-bold text-[var(--navy)]">Overview</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{company.description ?? "No description provided yet."}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Fact label="STAGE" value={company.stage} />
                <Fact label="SEEKING" value={seeking(company)} />
                <Fact label="MRR" value={company.mrr ? company.mrr.replace(/^([a-z])/, (m) => m.toUpperCase()) : null} />
              </div>
            </div>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
              <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <h3 className="text-lg font-bold text-[var(--navy)]">Raise</h3>
                <div className="mt-2.5 text-sm">
                  <Row label="Target raise" value={seeking(company)} />
                  <Row label="Stage" value={company.stage} />
                  <Row label="Revenue" value={revenueLabel(company)} />
                  <Row label="MRR" value={company.mrr ?? null} last />
                </div>
              </div>
              <div className="rounded-xl bg-[var(--blue)] p-5 text-white">
                <p className="text-xl font-extrabold leading-tight tracking-tight">Interested in this company?</p>
                {canRequest ? (
                  <>
                    <p className="mt-2 text-sm leading-snug text-blue-100">Request an introduction and iCapOS routes it to the founder.</p>
                    <Link href={introHref} className="mt-3.5 inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-[var(--blue)]">
                      Request introduction
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-snug text-blue-100">Introductions are requested by approved investors.</p>
                )}
              </div>
            </div>
          </div>

          <p className="border-t border-slate-200 pt-3.5 font-mono text-[11px] leading-relaxed text-slate-600">
            Listing summary only: no documents and no score breakdown. Informational, not an investment recommendation.
          </p>
        </div>
      </div>
    </div>
  );
}
