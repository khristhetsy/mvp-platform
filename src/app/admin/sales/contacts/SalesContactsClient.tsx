"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type SalesContact = { id: string; name: string; email: string; company: string; phone: string; source: string; type: string; country: string; createdOn: string; assignees?: string[] };
type GroupState = { rows: SalesContact[]; total: number; loading: boolean };
type Facets = { counts: Record<string, number>; countries: { value: string; n: number }[] };
type TextFilters = { name: string; company: string; email: string; phone: string };
type Sort = { key: string; dir: "asc" | "desc" };

const GROUP_DEFS = [
  { id: "founder", label: "Founders" },
  { id: "investor", label: "Investors" },
  { id: "advisor", label: "Advisors" },
  { id: "other", label: "Other" },
] as const;

const PAGE = 50;

type ColKind = "text" | "country" | "none";
type ColMeta = { key: string; label: string; width: string; kind: ColKind; sortable: boolean; always?: boolean };
const ALL_COLUMNS: ColMeta[] = [
  { key: "name", label: "Name", width: "1.5fr", kind: "text", sortable: true, always: true },
  { key: "company", label: "Company", width: "1.3fr", kind: "text", sortable: true },
  { key: "type", label: "Type", width: "88px", kind: "none", sortable: false },
  { key: "phone", label: "Phone", width: "1fr", kind: "text", sortable: false },
  { key: "email", label: "Email", width: "1.4fr", kind: "text", sortable: true },
  { key: "lead_assign", label: "Lead assign", width: "1.1fr", kind: "none", sortable: false },
  { key: "country", label: "Country", width: "100px", kind: "country", sortable: true },
  { key: "created_on", label: "Created on", width: "104px", kind: "none", sortable: true },
];

const TYPE_BADGE: Record<string, { t: string; c: string; bg: string }> = {
  founder: { t: "Founder", c: "#712B13", bg: "#FAECE7" },
  investor: { t: "Investor", c: "#0C447C", bg: "#E6F1FB" },
  advisor: { t: "Advisor", c: "#633806", bg: "#FAEEDA" },
  other: { t: "Other", c: "#444441", bg: "#F1EFE8" },
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

function buildParams(q: string, tf: TextFilters, countries: string[], sort: Sort): string {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  (["name", "company", "email", "phone"] as const).forEach((k) => { if (tf[k].trim()) sp.set(k, tf[k].trim()); });
  if (countries.length) sp.set("country", countries.join(","));
  if (sort.key !== "name" || sort.dir !== "asc") { sp.set("sort", sort.key); sp.set("dir", sort.dir); }
  return sp.toString();
}

export function SalesContactsClient() {
  const [q, setQ] = useState("");
  const [textFilters, setTextFilters] = useState<TextFilters>({ name: "", company: "", email: "", phone: "" });
  const [countries, setCountries] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(() => loadLS<Sort>("salesContacts.sort", { key: "name", dir: "asc" }));
  const [visibleCols, setVisibleCols] = useState<string[]>(() => loadLS<string[]>("salesContacts.cols", ALL_COLUMNS.map((c) => c.key)));

  const [facets, setFacets] = useState<Facets>({ counts: {}, countries: [] });
  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ founder: true, investor: true, advisor: true });

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [openColPicker, setOpenColPicker] = useState(false);
  const [draft, setDraft] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", email: "", company: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const paramsStr = useMemo(() => buildParams(q, textFilters, countries, sort), [q, textFilters, countries, sort]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => c.always || visibleCols.includes(c.key)), [visibleCols]);
  const gridCols = useMemo(() => visibleColumns.map((c) => c.width).join(" "), [visibleColumns]);

  useEffect(() => { try { window.localStorage.setItem("salesContacts.cols", JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);
  useEffect(() => { try { window.localStorage.setItem("salesContacts.sort", JSON.stringify(sort)); } catch { /* ignore */ } }, [sort]);

  const loadAll = useCallback(async (params: string) => {
    setGroups((prev) => {
      const next = { ...prev };
      for (const g of GROUP_DEFS) next[g.id] = { rows: next[g.id]?.rows ?? [], total: next[g.id]?.total ?? 0, loading: true };
      return next;
    });
    const entries = await Promise.all(GROUP_DEFS.map(async (g) => {
      try {
        const res = await fetch(`/api/sales/contacts?group=${g.id}&offset=0&limit=${PAGE}${params ? `&${params}` : ""}`);
        const data = res.ok ? await res.json() : { contacts: [], total: 0 };
        return [g.id, { rows: data.contacts ?? [], total: data.total ?? 0, loading: false }] as const;
      } catch { return [g.id, { rows: [], total: 0, loading: false }] as const; }
    }));
    setGroups(Object.fromEntries(entries));
  }, []);

  const loadFacets = useCallback(async (params: string) => {
    try {
      const res = await fetch(`/api/sales/contacts/facets${params ? `?${params}` : ""}`);
      if (res.ok) setFacets(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void loadAll(paramsStr); void loadFacets(paramsStr); }, 300);
    return () => clearTimeout(t);
  }, [paramsStr, loadAll, loadFacets]);

  async function loadMore(groupId: string) {
    const gs = groups[groupId];
    if (!gs) return;
    setGroups((prev) => ({ ...prev, [groupId]: { ...prev[groupId], loading: true } }));
    try {
      const res = await fetch(`/api/sales/contacts?group=${groupId}&offset=${gs.rows.length}&limit=${PAGE}${paramsStr ? `&${paramsStr}` : ""}`);
      const data = res.ok ? await res.json() : { contacts: [], total: gs.total };
      setGroups((prev) => ({ ...prev, [groupId]: { rows: [...prev[groupId].rows, ...(data.contacts ?? [])], total: data.total ?? prev[groupId].total, loading: false } }));
    } catch { setGroups((prev) => ({ ...prev, [groupId]: { ...prev[groupId], loading: false } })); }
  }

  async function addContact() {
    if (!addDraft.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/sales/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addDraft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed.");
      setAdding(false); setAddDraft({ name: "", email: "", company: "", phone: "" });
      await Promise.all([loadAll(paramsStr), loadFacets(paramsStr)]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Add failed."); } finally { setBusy(false); }
  }

  function openText(col: string) { setDraft(textFilters[col as keyof TextFilters]); setCountrySearch(""); setOpenFilter(openFilter === col ? null : col); }
  function applyText(col: string) { setTextFilters((f) => ({ ...f, [col]: draft })); setOpenFilter(null); }
  function clearText(col: string) { setTextFilters((f) => ({ ...f, [col]: "" })); setOpenFilter(null); }
  function toggleCountry(v: string) { setCountries((c) => c.includes(v) ? c.filter((x) => x !== v) : [...c, v]); }
  function toggleSort(key: string) { setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  function toggleCol(key: string) { setVisibleCols((v) => v.includes(key) ? v.filter((x) => x !== key) : [...v, key]); }

  const inp: React.CSSProperties = { fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const activeFilters = countries.length + (["name", "company", "email", "phone"] as const).filter((k) => textFilters[k]).length;
  const visibleCountries = facets.countries.filter((c) => c.value.toLowerCase().includes(countrySearch.toLowerCase()));

  function renderCell(key: string, c: SalesContact) {
    switch (key) {
      case "name": return <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>;
      case "company": return <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company || "—"}</div>;
      case "type": { const tb = TYPE_BADGE[c.type] ?? TYPE_BADGE.other; return <div><span style={{ fontSize: 10, fontWeight: 600, color: tb.c, background: tb.bg, borderRadius: 10, padding: "2px 8px" }}>{tb.t}</span></div>; }
      case "phone": return <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: c.phone ? "var(--foreground)" : "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.phone || "—"}</div>;
      case "email": return <div style={{ color: "#185FA5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email || "—"}</div>;
      case "lead_assign": return c.assignees && c.assignees.length ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", overflow: "hidden" }}>
          {c.assignees.slice(0, 2).map((n) => <span key={n} style={{ fontSize: 10, background: "#E6F1FB", color: "#185FA5", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>{n}</span>)}
          {c.assignees.length > 2 && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>+{c.assignees.length - 2}</span>}
        </div>
      ) : <div style={{ color: "var(--muted-foreground)" }}>—</div>;
      case "country": return <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.country || "—"}</div>;
      case "created_on": return <div style={{ color: "var(--muted-foreground)", fontSize: 11.5, whiteSpace: "nowrap" }}>{c.createdOn ? c.createdOn.slice(0, 10) : "—"}</div>;
      default: return null;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, phone…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        {activeFilters > 0 && (
          <button onClick={() => { setTextFilters({ name: "", company: "", email: "", phone: "" }); setCountries([]); }} style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}</button>
        )}
        <div style={{ position: "relative" }}>
          <button onClick={() => { setOpenColPicker((v) => !v); setOpenFilter(null); }} style={{ fontSize: 12, color: "var(--foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><i className="ti ti-columns-3" style={{ fontSize: 15 }} aria-hidden="true" /> Columns</button>
          {openColPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 190, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 8 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 4px 6px" }}>Show columns</div>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", fontSize: 12, cursor: col.always ? "default" : "pointer", opacity: col.always ? 0.55 : 1 }}>
                  <input type="checkbox" checked={col.always || visibleCols.includes(col.key)} disabled={col.always} onChange={() => toggleCol(col.key)} style={{ width: 14, height: 14 }} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>+ Add contact</button>
      </div>

      {adding && (
        <div style={{ background: "#F5F9FF", border: "0.5px solid #BFDBFE", borderRadius: 10, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <input value={addDraft.name} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} placeholder="Name *" autoFocus style={inp} />
          <input value={addDraft.email} onChange={(e) => setAddDraft({ ...addDraft, email: e.target.value })} placeholder="Email" style={inp} />
          <input value={addDraft.company} onChange={(e) => setAddDraft({ ...addDraft, company: e.target.value })} placeholder="Company" style={inp} />
          <input value={addDraft.phone} onChange={(e) => setAddDraft({ ...addDraft, phone: e.target.value })} placeholder="Phone" style={inp} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={addContact} disabled={busy || !addDraft.name.trim()} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !addDraft.name.trim() ? 0.5 : 1 }}>Save</button>
            <button onClick={() => { setAdding(false); setErr(null); }} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
          {err && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#A32D2D" }}>{err}</div>}
        </div>
      )}

      {(openFilter || openColPicker) && <div onClick={() => { setOpenFilter(null); setOpenColPicker(false); }} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "9px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          {visibleColumns.map((h) => {
            const filterActive = h.kind === "country" ? countries.length > 0 : h.kind === "text" ? !!textFilters[h.key as keyof TextFilters] : false;
            const sortActive = sort.key === h.key;
            return (
              <div key={h.key} style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
                <span onClick={h.sortable ? () => toggleSort(h.key) : undefined} style={{ cursor: h.sortable ? "pointer" : "default", color: filterActive || sortActive ? "#185FA5" : "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {h.label}
                  {h.sortable && sortActive && <i className={sort.dir === "asc" ? "ti ti-arrow-up" : "ti ti-arrow-down"} style={{ fontSize: 12 }} aria-hidden="true" />}
                </span>
                {h.kind !== "none" && (
                  <button onClick={() => (h.kind === "country" ? (setOpenFilter(openFilter === "country" ? null : "country"), setOpenColPicker(false)) : openText(h.key))} aria-label={`Filter ${h.label}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: filterActive ? "#185FA5" : "var(--muted-foreground)", display: "inline-flex" }}>
                    <i className={filterActive ? "ti ti-filter-filled" : "ti ti-filter"} style={{ fontSize: 13 }} aria-hidden="true" />
                  </button>
                )}
                {openFilter === h.key && h.kind === "text" && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, width: 220, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 10, textTransform: "none", letterSpacing: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{h.label} contains</div>
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyText(h.key)} autoFocus placeholder="Type to filter…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button onClick={() => applyText(h.key)} style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px", cursor: "pointer" }}>Apply</button>
                      <button onClick={() => clearText(h.key)} style={{ flex: 1, fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px", cursor: "pointer" }}>Clear</button>
                    </div>
                  </div>
                )}
                {openFilter === "country" && h.kind === "country" && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 240, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 10, textTransform: "none", letterSpacing: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>Filter by country</div>
                    <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search values…" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {visibleCountries.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "6px 2px" }}>No values.</div>}
                      {visibleCountries.map((c) => (
                        <label key={c.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 12, cursor: "pointer" }}>
                          <input type="checkbox" checked={countries.includes(c.value)} onChange={() => toggleCountry(c.value)} style={{ width: 14, height: 14 }} />
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</span>
                          <span style={{ marginLeft: "auto", color: "var(--muted-foreground)", fontSize: 11 }}>{c.n.toLocaleString()}</span>
                        </label>
                      ))}
                    </div>
                    {countries.length > 0 && <button onClick={() => setCountries([])} style={{ width: "100%", marginTop: 8, fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px", cursor: "pointer" }}>Clear selection</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {GROUP_DEFS.map((g) => {
          const gs = groups[g.id];
          const count = facets.counts[g.id] ?? gs?.total ?? 0;
          const isOpen = !!expanded[g.id];
          return (
            <div key={g.id}>
              <button onClick={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "#E6F1FB", border: "none", borderTop: "0.5px solid #e2e6ed", cursor: "pointer" }}>
                <i className={isOpen ? "ti ti-chevron-down" : "ti ti-chevron-right"} style={{ fontSize: 15, color: "#0C447C" }} aria-hidden="true" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0C447C" }}>{g.label}</span>
                <span style={{ fontSize: 11, color: "#185FA5", background: "#B5D4F4", borderRadius: 10, padding: "1px 8px" }}>{count.toLocaleString()}</span>
              </button>
              {isOpen && (
                <div>
                  {gs?.loading && (gs?.rows.length ?? 0) === 0 ? (
                    <p style={{ padding: "14px", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
                  ) : (gs?.rows.length ?? 0) === 0 ? (
                    <p style={{ padding: "14px", fontSize: 12.5, color: "var(--muted-foreground)" }}>No matching contacts in this group.</p>
                  ) : (
                    <>
                      {gs!.rows.map((c) => (
                        <Link key={c.id} href={`/admin/sales/contacts/${c.id}`} style={{ display: "grid", gridTemplateColumns: gridCols, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, textDecoration: "none", color: "var(--foreground)" }}>
                          {visibleColumns.map((col) => <div key={col.key} style={{ minWidth: 0 }}>{renderCell(col.key, c)}</div>)}
                        </Link>
                      ))}
                      {gs!.rows.length < gs!.total && (
                        <button onClick={() => loadMore(g.id)} disabled={gs!.loading} style={{ width: "100%", padding: "9px", fontSize: 11.5, color: "#185FA5", background: "transparent", border: "none", borderTop: "0.5px solid #eef1f5", cursor: "pointer" }}>
                          {gs!.loading ? "Loading…" : `Load ${Math.min(PAGE, gs!.total - gs!.rows.length)} more of ${gs!.total.toLocaleString()}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 2px 0" }}>Grouped by membership type from Odoo (Entrepreneur shows as Founders). Click a column heading to sort, the filter icon to narrow by value, or Columns to choose what shows. Counts and filters run across all synced contacts.</p>
    </div>
  );
}
