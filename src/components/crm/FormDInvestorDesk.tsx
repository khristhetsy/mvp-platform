"use client";

import { useEffect, useState, useCallback } from "react";

type Firm = {
  id: string;
  display_name: string;
  city: string | null;
  state_or_country: string | null;
  vehicle_count: number;
  regd_footprint: number | null;
  fund_types: string[] | null;
  needs_review: boolean;
  promoted_at: string | null;
  activity_band: "observed" | "single" | "registry";
  ofac: "clear" | "hit" | "review" | "unavailable" | null;
  sec: "clear" | "hit" | "review" | "unavailable" | null;
  iapd: "clear" | "hit" | "review" | "unavailable" | null;
};

type Counts = { observed: number; single: number; registry: number; review: number; total: number };

const fmtUsd = (n: number | null) => (n == null ? "—" : `$${(n / 1_000_000).toFixed(1)}M`);

export function FormDInvestorDesk({ canPromote }: Readonly<{ canPromote: boolean }>) {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [counts, setCounts] = useState<Counts>({ observed: 0, single: 0, registry: 0, review: 0, total: 0 });
  const [total, setTotal] = useState(0); // filtered total for the current search/filter
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(100);
  const [q, setQ] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const clearSelection = () => { setSelected(new Set()); setSelectAllMatching(false); };

  const load = useCallback(async () => {
    setLoading(true);
    // A reload always follows a filter change or a promote, so clear any selection.
    setSelected(new Set());
    setSelectAllMatching(false);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (reviewOnly) p.set("band", "review");
      p.set("limit", String(perPage));
      p.set("offset", String(page * perPage));
      const res = await fetch(`/api/admin/crm/connectors/formd/firms?${p}`);
      const json = await res.json().catch(() => ({}));
      setFirms(json.firms ?? []);
      if (json.counts) setCounts(json.counts);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [q, reviewOnly, page, perPage]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const canSelect = (f: Firm) => !f.promoted_at && f.ofac !== "hit";
  const selectableFirms = firms.filter(canSelect);
  const allVisibleSelected = selectableFirms.length > 0 && selectableFirms.every((f) => selected.has(f.id));
  const matchingCount = total;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : page * perPage + 1;
  const rangeEnd = Math.min(total, (page + 1) * perPage);
  const selectionCount = selectAllMatching ? matchingCount : selected.size;

  const toggleRow = (id: string) => {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelectAllMatching(false);
    setSelected(allVisibleSelected ? new Set() : new Set(selectableFirms.map((f) => f.id)));
  };

  async function promote(f: Firm) {
    const basis = window.prompt(`Promote "${f.display_name}" into the investor list.\nGDPR lawful basis (recorded per record):`, "legitimate_interest");
    if (!basis) return;
    setBusyId(f.id);
    setNote(null);
    try {
      const res = await fetch("/api/admin/crm/connectors/formd/promote-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId: f.id, lawfulBasis: basis }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setNote(res.status === 409 ? `Blocked: ${j.error}` : j.error ?? "Promote failed.");
      else if (j.action === "review") setNote(`${f.display_name}: a similar investor exists — held for review.`);
      else { setNote(`${f.display_name}: ${j.action === "matched" ? "matched an existing investor" : "added to the investor list"}.`); load(); }
    } finally {
      setBusyId(null);
    }
  }

  async function bulkPromote() {
    if (selectionCount === 0) return;
    const basis = window.prompt(`Promote ${selectionCount.toLocaleString()} firm${selectionCount === 1 ? "" : "s"} into the investor list.\nGDPR lawful basis (recorded for every record):`, "legitimate_interest");
    if (!basis) return;
    setBulkBusy(true);
    setNote(null);
    try {
      const body = selectAllMatching
        ? { lawfulBasis: basis, all: true, q: q || undefined, band: reviewOnly ? "review" : undefined }
        : { lawfulBasis: basis, firmIds: [...selected] };
      const res = await fetch("/api/admin/crm/connectors/formd/promote-investor/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setNote(j.error ?? "Bulk promote failed."); return; }
      const parts: string[] = [];
      if (j.created) parts.push(`${j.created} added`);
      if (j.matched) parts.push(`${j.matched} matched existing`);
      if (j.review) parts.push(`${j.review} held for review`);
      if (j.blocked) parts.push(`${j.blocked} blocked (OFAC)`);
      if (j.failed) parts.push(`${j.failed} failed`);
      setNote(`Promoted ${j.total?.toLocaleString?.() ?? j.total}${parts.length ? ` — ${parts.join(", ")}` : ""}.`);
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  const flags = (f: Firm) => {
    const out: { t: string; c: string; b: string }[] = [];
    if (f.ofac === "hit") out.push({ t: "OFAC", c: "var(--text-danger)", b: "var(--bg-danger)" });
    else if (f.ofac === "review") out.push({ t: "OFAC?", c: "var(--text-warning)", b: "var(--bg-warning)" });
    if (f.sec === "hit" || f.sec === "review") out.push({ t: "SEC", c: "var(--text-warning)", b: "var(--bg-warning)" });
    if (f.iapd === "review") out.push({ t: "Not IA-reg", c: "var(--text-muted)", b: "var(--surface-1)" });
    return out;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search firms" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => { setReviewOnly((v) => !v); setPage(0); }}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${reviewOnly ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500 hover:text-slate-700"}`}
        >
          Needs review · {counts.review.toLocaleString()}
        </button>
        <span className="text-xs text-slate-500">{counts.total.toLocaleString()} firms</span>
      </div>

      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
        <span className="font-medium text-slate-700">Verified registry.</span> Investment firms extracted from SEC Form D
        filings and screened against OFAC / SEC. Form D does not disclose who invested in a given raise, so these are
        verified filers — not an activity ranking. A lead signal, not a cap table.
      </div>

      {canPromote && selectionCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2">
          <span className="text-xs font-medium text-indigo-700">{selectionCount.toLocaleString()} selected</span>
          {!selectAllMatching && allVisibleSelected && matchingCount > selectableFirms.length ? (
            <button type="button" onClick={() => setSelectAllMatching(true)} className="text-xs font-medium text-indigo-600 underline">
              Select all {matchingCount.toLocaleString()} matching this filter
            </button>
          ) : null}
          <span className="flex-1" />
          <button type="button" disabled={bulkBusy} onClick={bulkPromote} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {bulkBusy ? "Promoting…" : `Promote ${selectionCount.toLocaleString()} to contacts`}
          </button>
          <button type="button" onClick={clearSelection} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Clear</button>
        </div>
      ) : null}
      {note ? <p className="mb-3 text-xs font-medium text-indigo-700">{note}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
              {canPromote ? (
                <th className="w-9 px-3 py-2.5">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={selectableFirms.length === 0} aria-label="Select all firms on this page" className="h-3.5 w-3.5 align-middle" />
                </th>
              ) : null}
              <th className="px-3 py-2.5">FIRM</th>
              <th className="w-28 px-3 py-2.5">REG D FILED</th>
              <th className="w-20 px-3 py-2.5">VEHICLES</th>
              <th className="px-3 py-2.5">FUND TYPES</th>
              <th className="w-28 px-3 py-2.5">FLAGS</th>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={canPromote ? 7 : 6} className="px-3 py-6 text-slate-500">Loading firms…</td></tr>
            ) : firms.length === 0 ? (
              <tr><td colSpan={canPromote ? 7 : 6} className="px-3 py-6 text-slate-500">No firms match. Run the rollup to populate from investor filings.</td></tr>
            ) : (
              firms.map((f) => {
                const isSelected = selectAllMatching ? canSelect(f) : selected.has(f.id);
                return (
                  <tr key={f.id} className={`align-top hover:bg-slate-50 ${isSelected ? "bg-indigo-50/60" : ""}`}>
                    {canPromote ? (
                      <td className="px-3 py-2.5">
                        {canSelect(f) ? (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(f.id)} aria-label={`Select ${f.display_name}`} className="h-3.5 w-3.5 align-middle" />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="min-w-0 px-3 py-2.5">
                      <p className="truncate font-medium text-slate-900">{f.display_name}</p>
                      <p className="truncate text-[11px] text-slate-400">{[f.city, f.state_or_country].filter(Boolean).join(", ") || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {fmtUsd(f.regd_footprint)}
                      <span className="block text-[10px] text-slate-400">total offering</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{f.vehicle_count}</td>
                    <td className="min-w-0 px-3 py-2.5">
                      <p className="truncate text-slate-600">{f.fund_types && f.fund_types.length ? f.fund_types.join(", ") : "—"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {flags(f).length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          flags(f).map((fl) => (
                            <span key={fl.t} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: fl.b, color: fl.c }}>{fl.t}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {!canPromote ? null : f.promoted_at ? (
                        <span className="text-[11px] text-indigo-500">Promoted</span>
                      ) : f.ofac === "hit" ? (
                        <span title="OFAC hit — promote blocked" className="cursor-not-allowed rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-400">Blocked</span>
                      ) : (
                        <button type="button" disabled={busyId === f.id} onClick={() => promote(f)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                          {busyId === f.id ? "…" : "Promote"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}</span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5">
            Per page
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Back</button>
            <span className="px-2">Page {page + 1} of {totalPages.toLocaleString()}</span>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
