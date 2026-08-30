"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FilingRow = {
  accessionNo: string; cik: string; formType: string; companyName: string; city: string | null; state: string | null;
  isFund: boolean; totalRemaining: number | null; pctSold: number | null; daysSinceFirstSale: number | null;
  saleYetToOccur: boolean; hasPlacementAgent: boolean; is506c: boolean; formdScore: number | null;
  derivedFundingStage: string | null; derivedInvestorType: string | null; scoreNotes: string | null;
  filingUrl: string | null; promotedContactId: string | null; heldForReview: boolean;
};

const VIEWS: Array<{ key: string; label: string }> = [
  { key: "eligible", label: "Promote-eligible" },
  { key: "stall_window", label: "Stall window" },
  { key: "aging_in", label: "Aging in" },
  { key: "agent_watch", label: "Agent watch" },
  { key: "all", label: "All filings" },
];

const usd = (n: number | null) => (n == null ? "—" : `$${(n / 1_000_000).toFixed(1)}M`);

export function FormDReviewClient({ canPromote }: { canPromote: boolean }) {
  const [view, setView] = useState("eligible");
  const [rows, setRows] = useState<FilingRow[]>([]);
  const [count, setCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [match, setMatch] = useState<{ accessionNo: string; contactId: string; contactName: string } | null>(null);
  const [minScore, setMinScore] = useState(70);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    setSelectAllMatching(false);
    try {
      const res = await fetch(`/api/admin/crm/connectors/formd/filings?view=${view}&minScore=${view === "all" || view === "agent_watch" ? 0 : minScore}`);
      const j = await res.json();
      setRows(j.rows ?? []);
      setCount(j.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [view, minScore]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on view/filter change
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    // per-view counts for the tabs
    void (async () => {
      const entries = await Promise.all(VIEWS.map(async (v) => {
        const res = await fetch(`/api/admin/crm/connectors/formd/filings?view=${v.key}&limit=1`);
        const j = await res.json();
        return [v.key, j.count ?? 0] as [string, number];
      }));
      setCounts(Object.fromEntries(entries));
    })();
  }, []);

  function toggle(id: string) {
    setSelectAllMatching(false);
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const clearSelection = () => { setSelected(new Set()); setSelectAllMatching(false); };

  async function promote(accessionNo: string, resolve?: "create" | "link", contactId?: string) {
    setBusy(accessionNo);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/crm/connectors/formd/promote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessionNo, resolve, contactId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Promote failed.");
      if (j.action === "possible_match") {
        setMatch({ accessionNo, contactId: j.contactId, contactName: j.contactName });
        return;
      }
      setMatch(null);
      setRows((rs) => rs.map((r) => (r.accessionNo === accessionNo ? { ...r, promotedContactId: j.contactId } : r)));
      setMsg(`Contact ${j.action}.`);
      void refreshCounts();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Promote failed.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshCounts() {
    const entries = await Promise.all(VIEWS.map(async (v) => {
      const res = await fetch(`/api/admin/crm/connectors/formd/filings?view=${v.key}&limit=1`);
      const j = await res.json();
      return [v.key, j.count ?? 0] as [string, number];
    }));
    setCounts(Object.fromEntries(entries));
  }

  async function bulkPromote() {
    const explicit = rows.filter((r) => selected.has(r.accessionNo) && !r.promotedContactId).map((r) => r.accessionNo);
    if (!selectAllMatching && explicit.length === 0) return;
    setBulkBusy(true);
    setMsg(null);
    setMatch(null);
    try {
      const body = selectAllMatching
        ? { all: true, view, minScore: view === "all" || view === "agent_watch" ? 0 : minScore }
        : { accessionNos: explicit };
      const res = await fetch("/api/admin/crm/connectors/formd/promote/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(typeof j.error === "string" ? j.error : "Bulk promote failed."); return; }
      const parts: string[] = [];
      if (j.created) parts.push(`${j.created} created`);
      if (j.updated) parts.push(`${j.updated} updated`);
      if (j.linked) parts.push(`${j.linked} linked`);
      if (j.failed) parts.push(`${j.failed} failed`);
      setMsg(`Promoted ${j.total}${parts.length ? ` — ${parts.join(", ")}` : ""}.`);
      clearSelection();
      void load();
      void refreshCounts();
    } finally {
      setBulkBusy(false);
    }
  }

  const selectable = useMemo(() => rows.filter((r) => !r.promotedContactId), [rows]);
  const allVisibleSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.accessionNo));
  const selectionCount = selectAllMatching ? count : selected.size;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => setView(v.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${view === v.key ? "text-white" : "border border-slate-200 text-slate-600"}`} style={view === v.key ? { background: "#0A1A40" } : undefined}>
            {v.label}{counts[v.key] != null ? ` · ${counts[v.key]}` : ""}
          </button>
        ))}
        {view !== "all" && view !== "agent_watch" && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
            Min score
            <input type="number" value={minScore} min={0} max={100} onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs" />
          </label>
        )}
      </div>

      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}

      {canPromote && selectionCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-[#EAF1FB] px-3 py-2">
          <span className="text-xs font-medium text-[#185FA5]">{selectionCount.toLocaleString()} selected</span>
          {!selectAllMatching && allVisibleSelected && count > selectable.length && (
            <button type="button" onClick={() => setSelectAllMatching(true)} className="text-xs font-medium text-[#1A6CE4] underline">
              Select all {count.toLocaleString()} in this view
            </button>
          )}
          <button type="button" disabled={bulkBusy} onClick={bulkPromote} className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: "#1A6CE4" }}>{bulkBusy ? "Promoting…" : `Promote ${selectionCount.toLocaleString()} to contacts`}</button>
          <button type="button" onClick={clearSelection} className="text-xs text-slate-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              {canPromote && <th className="w-8 px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={() => { setSelectAllMatching(false); setSelected((s) => (selectable.every((r) => s.has(r.accessionNo)) ? new Set() : new Set(selectable.map((r) => r.accessionNo)))); }} /></th>}
              <th className="px-3 py-2">Score</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Remaining</th>
              <th className="px-3 py-2">Days</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Flags</th><th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">No filings in this view.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.accessionNo} className="border-b border-slate-100 align-top last:border-0">
                {canPromote && <td className="px-3 py-2">{!r.promotedContactId && <input type="checkbox" checked={selectAllMatching || selected.has(r.accessionNo)} onChange={() => toggle(r.accessionNo)} />}</td>}
                <td className="px-3 py-2"><span className="inline-flex h-7 w-9 items-center justify-center rounded-md text-xs font-semibold text-white" style={{ background: (r.formdScore ?? 0) >= 80 ? "#0F6E56" : (r.formdScore ?? 0) >= 70 ? "#1A6CE4" : "#94a3b8" }}>{r.formdScore ?? "—"}</span></td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{r.companyName}</div>
                  <div className="text-[11px] text-slate-500">{[r.city, r.state].filter(Boolean).join(", ")} · {r.formType} · {r.derivedInvestorType ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-slate-700">{usd(r.totalRemaining)}{r.pctSold != null ? <span className="text-[11px] text-slate-400"> · {r.pctSold}% sold</span> : null}</td>
                <td className="px-3 py-2 text-slate-700">{r.saleYetToOccur ? "no sale" : r.daysSinceFirstSale != null ? `${r.daysSinceFirstSale}d` : "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.derivedFundingStage ?? "—"}</td>
                <td className="px-3 py-2 text-[11px]">
                  {r.isFund && <span className="mr-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">fund</span>}
                  {r.hasPlacementAgent && <span className="mr-1 rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">agent</span>}
                  {r.is506c && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">506(c)</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.promotedContactId ? (
                    <a href={`/admin/crm/record/${r.promotedContactId}`} className="text-xs font-medium text-emerald-700 hover:underline">Promoted ✓</a>
                  ) : canPromote ? (
                    match?.accessionNo === r.accessionNo ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-amber-700">Possible match: {match.contactName}</span>
                        <span className="flex gap-2">
                          <button type="button" onClick={() => promote(r.accessionNo, "link", match.contactId)} className="text-xs font-medium text-[#1A6CE4] hover:underline">Link</button>
                          <button type="button" onClick={() => promote(r.accessionNo, "create")} className="text-xs font-medium text-slate-600 hover:underline">Create anyway</button>
                        </span>
                      </div>
                    ) : (
                      <button type="button" onClick={() => promote(r.accessionNo)} disabled={busy === r.accessionNo} className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "#1A6CE4" }}>{busy === r.accessionNo ? "…" : "Promote"}</button>
                    )
                  ) : (
                    r.filingUrl && <a href={r.filingUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:underline">Filing ↗</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{count} in this view. Filters run at query time — widening a filter never re-fetches EDGAR.</p>
    </div>
  );
}
