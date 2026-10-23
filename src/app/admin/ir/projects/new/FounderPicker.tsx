"use client";

/**
 * Founder picker for Create project. Searches every Founder in the shared CRM (the same
 * /api/sales/contacts search the Sales Contacts grid uses, scoped to the Founder group),
 * with quick filters and a country filter. Founders that already have an active IR project
 * are flagged so the owner sees the one-active-project rule before creating.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Condition } from "@/lib/sales/contact-filter-spec";

export type PickedFounder = { id: string; name: string; company: string; email: string; country: string };
type Row = PickedFounder & { phone: string; assignees?: string[] };

const PAGE = 25;
const chipBase = "rounded-full border px-2.5 py-1 text-[11.5px]";

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function FounderPicker({ value, onPick, activeContactIds }: { value: PickedFounder | null; onPick: (f: PickedFounder) => void; activeContactIds: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [noSalesOpp, setNoSalesOpp] = useState(false);
  const [thisMonth, setThisMonth] = useState(false);
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!open || countries.length) return;
    fetch("/api/sales/contacts/filter-facets").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.countries) setCountries((d.countries as Array<{ value: string }>).map((c) => c.value));
    }).catch(() => { /* country filter is optional */ });
  }, [open, countries.length]);
  useEffect(() => {
    function away(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const filterJson = useMemo(() => {
    const conditions: Condition[] = [];
    if (hasEmail) conditions.push({ field: "email", op: "set" });
    if (hasPhone) conditions.push({ field: "phone", op: "set" });
    if (noSalesOpp) conditions.push({ field: "salesOpp", op: "not_set" });
    if (thisMonth) conditions.push({ field: "createdAt", op: "after", value: monthStart() });
    if (country) conditions.push({ field: "country", op: "in", value: [country] });
    return conditions.length ? JSON.stringify({ match: "all", conditions }) : "";
  }, [hasEmail, hasPhone, noSalesOpp, thisMonth, country]);

  // New query → back to page 0 and a fresh list.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); setRows([]); }, [dq, filterJson]);
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const sp = new URLSearchParams({ group: "founder", limit: String(PAGE), offset: String(page * PAGE) });
    if (dq) sp.set("q", dq);
    if (filterJson) sp.set("filter", filterJson);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(null);
    fetch(`/api/sales/contacts?${sp}`, { signal: ctl.signal })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Couldn't search Founders."); return j; })
      .then((j) => {
        setTotal(Number(j.total) || 0);
        const next = (j.contacts as Row[]) ?? [];
        setRows((prev) => (page === 0 ? next : [...prev, ...next]));
      })
      .catch((e) => { if (e?.name !== "AbortError") setError(e instanceof Error ? e.message : "Couldn't search Founders."); })
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [open, dq, filterJson, page]);

  const chips: Array<[string, boolean, () => void]> = [
    ["Has email", hasEmail, () => setHasEmail((v) => !v)],
    ["Has phone", hasPhone, () => setHasPhone((v) => !v)],
    ["Not in sales pipeline", noSalesOpp, () => setNoSalesOpp((v) => !v)],
    ["Added this month", thisMonth, () => setThisMonth((v) => !v)],
  ];

  return (
    <div ref={boxRef} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-[13px] hover:border-indigo-300 focus:border-indigo-400 focus:outline-none">
        {value ? (
          <span><span className="font-medium text-slate-900">{value.company || value.name}</span><span className="ml-2 text-[11.5px] text-slate-500">{value.company ? value.name : ""}{value.country ? ` · ${value.country}` : ""}</span></span>
        ) : <span className="text-slate-400">Search all Founders…</span>}
        <span aria-hidden="true" className="text-slate-400">▾</span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2.5">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, company, email or phone" aria-label="Search Founders" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Filters</span>
              {chips.map(([label, on, toggle]) => (
                <button key={label} type="button" aria-pressed={on} onClick={toggle} className={`${chipBase} ${on ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{on ? "✓ " : ""}{label}</button>
              ))}
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className={`${chipBase} border-slate-200 bg-white text-slate-600`}>
                <option value="">Any country</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="ml-auto text-[11.5px] text-slate-500">{loading && !rows.length ? "Searching…" : `${rows.length} of ${total.toLocaleString()} Founders`}</span>
            </div>
          </div>

          <ul className="max-h-[360px] overflow-y-auto" role="listbox">
            {rows.map((r) => {
              const active = activeContactIds.has(r.id);
              return (
                <li key={r.id} role="option" aria-selected={value?.id === r.id}>
                  <button type="button" onClick={() => { onPick({ id: r.id, name: r.name, company: r.company, email: r.email, country: r.country }); setOpen(false); }} className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50 ${value?.id === r.id ? "bg-indigo-50" : ""}`}>
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700">{(r.company || r.name).slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{r.company || r.name}</span>
                      <span className="block truncate text-[11.5px] text-slate-500">{r.company ? `${r.name} · ` : ""}{r.email || "No email"}{r.country ? ` · ${r.country}` : ""}{r.assignees?.length ? ` · Owner: ${r.assignees.join(", ")}` : ""}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${active ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{active ? "Has active project" : "No active project"}</span>
                  </button>
                </li>
              );
            })}
            {error ? <li className="px-3 py-4 text-center text-[12.5px] text-rose-600">{error}</li> : null}
            {!loading && !error && !rows.length ? <li className="px-3 py-6 text-center text-[12.5px] text-slate-500">No Founders match this search.</li> : null}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11.5px] text-slate-500">
            <span>Searches every Founder in Sales Contacts, not only closed-won deals.</span>
            {rows.length < total ? <button type="button" disabled={loading} onClick={() => setPage((p) => p + 1)} className="font-medium text-indigo-700 disabled:opacity-50">{loading ? "Loading…" : "Load more"}</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
