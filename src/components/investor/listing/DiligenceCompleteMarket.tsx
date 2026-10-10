"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/api/errors";
import type { ListedCompany, PrivateMarketSort } from "@/lib/listing/private-market";

/**
 * Investor Private Market: every diligence complete company that opted in to
 * the listing, whatever its CRR. Investors filter by CRR, sector and stage and
 * decide. Shows the listing summary only; "Request introduction" uses the same
 * investor intro request API as the deal page.
 *
 * The filter logic is kept here rather than imported from private-market.ts,
 * which is server code (service role); it mirrors applyPrivateMarketFilter.
 */

const CRR_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Any" },
  { value: 40, label: "40+" },
  { value: 60, label: "60+" },
  { value: 80, label: "80+" },
];

const DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

function sectorsOf(industry: string | null): string[] {
  return String(industry ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function crrTone(crr: number | null): { ring: string; text: string } {
  if (crr == null) return { ring: "border-slate-200 bg-slate-50", text: "text-slate-500" };
  if (crr >= 80) return { ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-700" };
  if (crr >= 60) return { ring: "border-blue-200 bg-blue-50", text: "text-[#1A6CE4]" };
  return { ring: "border-slate-200 bg-slate-50", text: "text-[#0A1A40]" };
}

type RequestState = { status: "idle" | "sending" | "sent" | "error"; message?: string };

export function DiligenceCompleteMarket({
  companies,
  sectors,
  stages,
  requestedIds,
  highlightId,
}: Readonly<{
  companies: ListedCompany[];
  sectors: string[];
  stages: string[];
  /** Companies this investor already asked to be introduced to. */
  requestedIds: string[];
  /** ?company=<id>: scroll to and highlight one card (deal notice opt in). */
  highlightId: string | null;
}>) {
  const [minCrr, setMinCrr] = useState(0);
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [sort, setSort] = useState<PrivateMarketSort>("crr");
  const [requests, setRequests] = useState<Record<string, RequestState>>(() =>
    Object.fromEntries(requestedIds.map((id) => [id, { status: "sent" } as RequestState])),
  );

  const visible = useMemo(() => {
    const sec = sector.toLowerCase();
    const stg = stage.toLowerCase();
    const out = companies.filter((c) => {
      if (minCrr > 0 && (c.crr == null || c.crr < minCrr)) return false;
      if (sec && !sectorsOf(c.industry).some((s) => s.toLowerCase() === sec)) return false;
      if (stg && (c.stage ?? "").trim().toLowerCase() !== stg) return false;
      return true;
    });
    const newest = (a: ListedCompany, b: ListedCompany) => b.listedAt.localeCompare(a.listedAt);
    return out.sort((a, b) =>
      sort === "newest"
        ? newest(a, b) || a.name.localeCompare(b.name)
        : (b.crr ?? -1) - (a.crr ?? -1) || newest(a, b) || a.name.localeCompare(b.name),
    );
  }, [companies, minCrr, sector, stage, sort]);

  // The highlighted company must be on screen even if a filter would hide it,
  // so filters start at "Any"; scroll once after mount.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`listing-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);

  async function requestIntro(c: ListedCompany) {
    setRequests((r) => ({ ...r, [c.id]: { status: "sending" } }));
    try {
      const res = await fetch("/api/investor/intro-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: c.id, message: `Intro request for ${c.name}.` }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(payload, "Could not send the request."));
      setRequests((r) => ({ ...r, [c.id]: { status: "sent" } }));
    } catch (e) {
      setRequests((r) => ({ ...r, [c.id]: { status: "error", message: e instanceof Error ? e.message : "Could not send the request." } }));
    }
  }

  const filtered = minCrr > 0 || sector !== "" || stage !== "";
  const selectCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1A6CE4] focus:outline-none";

  return (
    <section id="diligence-complete" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0A1A40]">Diligence complete companies</h2>
          <p className="text-xs text-slate-500">
            {filtered ? (
              <>
                <span className="font-semibold tabular-nums text-slate-900">{visible.length}</span> of {companies.length} companies
              </>
            ) : (
              `${companies.length} ${companies.length === 1 ? "company" : "companies"}`
            )}{" "}
            · AI due diligence complete, figures attested by the founder
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Minimum CRR">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">CRR</span>
            {CRR_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setMinCrr(o.value)}
                aria-pressed={minCrr === o.value}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  minCrr === o.value
                    ? "border-[#1A6CE4] bg-blue-50 text-[#1A6CE4]"
                    : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} className={selectCls}>
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={selectCls}>
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as PrivateMarketSort)} className={selectCls}>
            <option value="crr">Highest CRR</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </header>

      {companies.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No companies have completed due diligence and opted in to the listing yet. New listings appear here as founders finish.
        </p>
      ) : visible.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          No companies match these filters.{" "}
          <button
            type="button"
            className="font-semibold text-[#1A6CE4] hover:underline"
            onClick={() => { setMinCrr(0); setSector(""); setStage(""); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const tone = crrTone(c.crr);
            const req = requests[c.id] ?? { status: "idle" };
            const highlighted = c.id === highlightId;
            const meta = [c.industry, c.stage, c.location].filter(Boolean).join(" · ");
            return (
              <article
                key={c.id}
                id={`listing-${c.id}`}
                className={`flex flex-col rounded-xl border bg-white p-4 transition-shadow ${
                  highlighted ? "border-[#1A6CE4] shadow-[0_0_0_3px_rgba(26,108,228,0.18)]" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[#0A1A40]">{c.name}</h3>
                    {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                    {c.raising ? <p className="mt-0.5 text-xs font-medium text-slate-600">{c.raising}</p> : null}
                  </div>
                  <div className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${tone.ring}`}>
                    {c.crr == null ? (
                      <span className="block text-[11px] font-medium leading-tight text-slate-500">Not yet<br />scored</span>
                    ) : (
                      <>
                        <span className={`block font-mono text-lg font-semibold leading-none ${tone.text}`}>{Math.round(c.crr)}</span>
                        <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">CRR</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Diligence complete</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Founder attested</span>
                  {highlighted ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">From your deal notice</span>
                  ) : null}
                </div>
                {c.description ? <p className="mt-3 flex-1 text-xs leading-5 text-slate-600">{c.description}</p> : <div className="flex-1" />}
                <div className="mt-4">
                  {req.status === "sent" ? (
                    <p className="text-xs font-semibold text-emerald-700">Introduction requested</p>
                  ) : (
                    <button
                      type="button"
                      disabled={req.status === "sending"}
                      onClick={() => requestIntro(c)}
                      className="rounded-lg bg-[#1A6CE4] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2E78F5] disabled:opacity-60"
                    >
                      {req.status === "sending" ? "Requesting…" : "Request introduction"}
                    </button>
                  )}
                  {req.status === "error" ? <p className="mt-2 text-xs text-red-700">{req.message}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] leading-5 text-slate-500">
        <p>All diligence complete companies are listed with their score.</p>
        <p>{DISCLAIMER}</p>
      </footer>
    </section>
  );
}
