"use client";

// Retention review (spec 5.5, mockup screen 7). Lists contacts whose found
// details passed the retention period and who were never contacted. Nothing is
// cleared until an admin selects rows and confirms. Clearing removes only what
// the finder added; the contact and any given email stay.

import { useCallback, useEffect, useState } from "react";

type Row = { id: string; name: string | null; company: string | null; email: string | null; email_source: string | null; phone: string | null; phone_source: string | null; found_at: string | null; retention_expires_at: string };
type Resp = { months: number; rows: Row[]; total: number; error?: string };

async function fetchRetention(): Promise<Resp> {
  const r = await fetch("/api/prospects/retention");
  return (await r.json()) as Resp;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export function RetentionReview() {
  const [data, setData] = useState<Resp | null>(null);
  const [months, setMonths] = useState(12);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((j: Resp) => {
    setData(j); setMonths(j.months); setSel(new Set());
    if (j.error) setError(`Retention data isn't available yet: ${j.error}`);
  }, []);
  const load = useCallback(async () => apply(await fetchRetention()), [apply]);
  useEffect(() => {
    let live = true;
    fetchRetention().then((j) => { if (live) apply(j); }).catch(() => { if (live) setError("Could not load retention data."); });
    return () => { live = false; };
  }, [apply]);

  async function saveMonths() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch("/api/prospects/retention", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Save failed.");
      setMsg(`Retention set to ${months} months. It applies to details accepted from now on.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }

  async function clearSelected() {
    if (sel.size === 0) return;
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch("/api/prospects/retention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel] }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Clear failed.");
      setMsg(`Cleared found details on ${j.cleared} contact${j.cleared === 1 ? "" : "s"}${j.skipped ? `; ${j.skipped} skipped because they were contacted or no longer expired` : ""}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Clear failed."); } finally { setBusy(false); }
  }

  const rows = data?.rows ?? [];
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">Retention</h3>
          <p className="text-[11.5px] text-slate-500">
            {data ? <>{data.total.toLocaleString()} contact{data.total === 1 ? "" : "s"} past retention and never contacted. </> : null}
            The clock starts when a found detail is first accepted and never restarts.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11.5px] text-slate-600" htmlFor="ret-months">Keep for</label>
          <select id="ret-months" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
            {[3, 6, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
          <button type="button" onClick={saveMonths} disabled={busy || !data || months === data.months} className="rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 disabled:opacity-40">Save</button>
          <button type="button" onClick={clearSelected} disabled={busy || sel.size === 0}
            className="rounded-md bg-[#B91C1C] px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40">
            Clear found details ({sel.size})
          </button>
        </div>
      </header>
      <div className="space-y-2 px-4 py-3">
        <p className="text-[11px] text-slate-500">Default 12 months, pending confirmation by counsel. Clearing removes found emails and phones only; given emails and phones, the contact and its history stay. Contacts whose found email was put on a send list are left out.</p>
        {msg ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-900">{msg}</p> : null}
        {error ? <p className="rounded-md bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">{error}</p> : null}
      </div>
      {!data ? <p className="px-4 pb-4 text-xs text-slate-500">Loading…</p> : rows.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-slate-500">Nothing past retention.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></th>
                <th className="px-2 py-2 text-left">Contact</th><th className="px-2 py-2 text-left">Found email</th><th className="px-2 py-2 text-left">Found phone</th><th className="px-2 py-2 text-left">Found</th><th className="px-4 py-2 text-left">Expired</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-1.5"><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={`Select ${r.name ?? r.id}`} /></td>
                  <td className="px-2 py-1.5"><div className="font-medium">{r.name ?? "—"}</div><div className="text-slate-500">{r.company ?? ""}</div></td>
                  <td className="px-2 py-1.5 font-mono">{r.email && r.email_source !== "given" ? r.email : "—"}</td>
                  <td className="px-2 py-1.5 font-mono">{r.phone_source && r.phone_source !== "given" ? r.phone : "—"}</td>
                  <td className="px-2 py-1.5">{fmt(r.found_at)}</td>
                  <td className="px-4 py-1.5 text-red-700">{fmt(r.retention_expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > rows.length ? <p className="px-4 py-2 text-[11px] text-slate-500">Showing {rows.length} of {data.total}; clear these to see the rest.</p> : null}
        </div>
      )}
    </section>
  );
}
