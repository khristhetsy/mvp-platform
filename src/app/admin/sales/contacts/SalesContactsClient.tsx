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

type FacetKey = "industries" | "capital" | "fundingStages" | "investorTypes" | "operatingStages";
const FACET_LABEL: Record<FacetKey, string> = {
  industries: "Type of industries",
  capital: "Amount / type of capital",
  fundingStages: "Funding stage",
  investorTypes: "Investor type",
  operatingStages: "Operating stage",
};
const FACETS_BY_ROLE: Record<string, FacetKey[]> = {
  founder: ["industries", "capital", "fundingStages", "operatingStages"],
  investor: ["investorTypes", "industries", "capital", "fundingStages", "operatingStages"],
  advisor: ["industries"],
  any: ["industries", "capital", "fundingStages", "investorTypes", "operatingStages"],
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

function buildParams(q: string, tf: TextFilters, countries: string[], sort: Sort, facetSel: Record<string, string[]>): string {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  (["name", "company", "email", "phone"] as const).forEach((k) => { if (tf[k].trim()) sp.set(k, tf[k].trim()); });
  if (countries.length) sp.set("country", countries.join(","));
  if (sort.key !== "name" || sort.dir !== "asc") { sp.set("sort", sort.key); sp.set("dir", sort.dir); }
  for (const [key, vals] of Object.entries(facetSel)) for (const v of vals) if (v) sp.append(key, v);
  return sp.toString();
}

export function SalesContactsClient({ canBulkAssign = false }: { canBulkAssign?: boolean }) {
  const [q, setQ] = useState("");
  const [textFilters, setTextFilters] = useState<TextFilters>({ name: "", company: "", email: "", phone: "" });
  const [countries, setCountries] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(() => loadLS<Sort>("salesContacts.sort", { key: "name", dir: "asc" }));
  // v2 key: bumped when the "Lead assign" column was added so a stale saved set
  // (from before that column existed) doesn't hide it. Resets column prefs once.
  const [visibleCols, setVisibleCols] = useState<string[]>(() => loadLS<string[]>("salesContacts.cols.v2", ALL_COLUMNS.map((c) => c.key)));

  const [facets, setFacets] = useState<Facets>({ counts: {}, countries: [] });
  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ founder: true, investor: true, advisor: true });

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [openColPicker, setOpenColPicker] = useState(false);
  const [draft, setDraft] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  // Role + questionnaire facet filters (Odoo-style Filters dropdown).
  const [role, setRole] = useState<"" | "founder" | "investor" | "advisor">("");
  const [facetSel, setFacetSel] = useState<Record<string, string[]>>({});
  const [facetOpts, setFacetOpts] = useState<Record<string, string[]>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFacetKey, setOpenFacetKey] = useState<string | null>(null);
  const [facetSearch, setFacetSearch] = useState("");

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", email: "", company: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mass Lead assign (super admin only).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSel, setAssignSel] = useState<string[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const paramsStr = useMemo(() => buildParams(q, textFilters, countries, sort, facetSel), [q, textFilters, countries, sort, facetSel]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => c.always || visibleCols.includes(c.key)), [visibleCols]);
  const gridCols = useMemo(() => visibleColumns.map((c) => c.width).join(" "), [visibleColumns]);
  const gridColsSel = canBulkAssign ? `34px ${gridCols}` : gridCols;

  useEffect(() => { try { window.localStorage.setItem("salesContacts.cols.v2", JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);
  useEffect(() => { try { window.localStorage.setItem("salesContacts.sort", JSON.stringify(sort)); } catch { /* ignore */ } }, [sort]);

  const loadAll = useCallback(async (params: string, roleFilter: string) => {
    const defs = roleFilter ? GROUP_DEFS.filter((g) => g.id === roleFilter) : GROUP_DEFS;
    setGroups((prev) => {
      const next = { ...prev };
      for (const g of GROUP_DEFS) next[g.id] = (roleFilter && g.id !== roleFilter)
        ? { rows: [], total: 0, loading: false }
        : { rows: next[g.id]?.rows ?? [], total: next[g.id]?.total ?? 0, loading: true };
      return next;
    });
    const entries = await Promise.all(defs.map(async (g) => {
      try {
        const res = await fetch(`/api/sales/contacts?group=${g.id}&offset=0&limit=${PAGE}${params ? `&${params}` : ""}`);
        const data = res.ok ? await res.json() : { contacts: [], total: 0 };
        return [g.id, { rows: data.contacts ?? [], total: data.total ?? 0, loading: false }] as const;
      } catch { return [g.id, { rows: [], total: 0, loading: false }] as const; }
    }));
    setGroups((prev) => {
      const next = { ...prev };
      for (const [id, st] of entries) next[id] = st;
      for (const g of GROUP_DEFS) if (roleFilter && g.id !== roleFilter) next[g.id] = { rows: [], total: 0, loading: false };
      return next;
    });
  }, []);

  const loadFacets = useCallback(async (params: string) => {
    try {
      const res = await fetch(`/api/sales/contacts/facets${params ? `?${params}` : ""}`);
      if (res.ok) setFacets(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void loadAll(paramsStr, role); void loadFacets(paramsStr); }, 300);
    return () => clearTimeout(t);
  }, [paramsStr, role, loadAll, loadFacets]);

  // Load the questionnaire facet option lists once (universal — same for everyone).
  useEffect(() => {
    fetch("/api/sales/contacts/filter-facets").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setFacetOpts(d as Record<string, string[]>); }).catch(() => {});
  }, []);

  // Members for the mass-assign picker (super admin only).
  useEffect(() => {
    if (!canBulkAssign) return;
    fetch("/api/sales/contacts/assignable-members").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.members) setMembers(d.members); }).catch(() => {});
  }, [canBulkAssign]);

  // The matching set changes with the filters — clear any selection so a stale
  // "select all matching" can't apply to a different set.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection on filter change
  useEffect(() => { setSelected(new Set()); setSelectAllMatching(false); setAssignOpen(false); }, [paramsStr, role]);

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
      await Promise.all([loadAll(paramsStr, role), loadFacets(paramsStr)]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Add failed."); } finally { setBusy(false); }
  }

  function openText(col: string) { setDraft(textFilters[col as keyof TextFilters]); setCountrySearch(""); setOpenFilter(openFilter === col ? null : col); }
  function applyText(col: string) { setTextFilters((f) => ({ ...f, [col]: draft })); setOpenFilter(null); }
  function clearText(col: string) { setTextFilters((f) => ({ ...f, [col]: "" })); setOpenFilter(null); }
  function toggleCountry(v: string) { setCountries((c) => c.includes(v) ? c.filter((x) => x !== v) : [...c, v]); }
  function toggleSort(key: string) { setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  function toggleCol(key: string) { setVisibleCols((v) => v.includes(key) ? v.filter((x) => x !== key) : [...v, key]); }
  function toggleFacet(key: string, v: string) {
    setFacetSel((s) => {
      const cur = s[key] ?? [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      const copy = { ...s };
      if (next.length) copy[key] = next; else delete copy[key];
      return copy;
    });
  }
  function clearAllFilters() { setRole(""); setFacetSel({}); setOpenFacetKey(null); }

  // ── Mass Lead assign helpers ──────────────────────────────────────────────
  const allLoadedIds = useMemo(() => GROUP_DEFS.flatMap((g) => (groups[g.id]?.rows ?? []).map((r) => r.id)), [groups]);
  const matchingTotal = role ? (facets.counts[role] ?? 0) : (facets.counts.total ?? 0);
  const selectionCount = selectAllMatching ? matchingTotal : selected.size;
  const allLoadedSelected = allLoadedIds.length > 0 && allLoadedIds.every((id) => selected.has(id));
  function toggleRow(id: string) { setSelectAllMatching(false); setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAllLoaded() { setSelectAllMatching(false); setSelected(allLoadedSelected ? new Set() : new Set(allLoadedIds)); }
  function clearSelection() { setSelected(new Set()); setSelectAllMatching(false); setAssignOpen(false); setAssignMsg(null); }
  const assignNames = members.filter((m) => assignSel.includes(m.id)).map((m) => m.name);
  async function submitAssign() {
    if (assignSel.length === 0) { setAssignMsg("Pick at least one member."); return; }
    setAssignBusy(true); setAssignMsg(null);
    try {
      const body = selectAllMatching
        ? { mode: "filter", memberIds: assignSel, params: paramsStr, group: role || undefined }
        : { mode: "ids", memberIds: assignSel, ids: [...selected] };
      const res = await fetch("/api/sales/contacts/bulk-assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assign failed.");
      clearSelection(); setAssignSel([]);
      await Promise.all([loadAll(paramsStr, role), loadFacets(paramsStr)]);
    } catch (e) { setAssignMsg(e instanceof Error ? e.message : "Assign failed."); } finally { setAssignBusy(false); }
  }

  const facetCount = Object.values(facetSel).reduce((a, v) => a + v.length, 0);
  const filterBadge = (role ? 1 : 0) + facetCount;
  const roleFacets = FACETS_BY_ROLE[role || "any"];

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
          <button onClick={() => { setFiltersOpen((v) => !v); setOpenColPicker(false); setOpenFilter(null); }} style={{ fontSize: 12, fontWeight: 500, color: filterBadge ? "#fff" : "var(--foreground)", background: filterBadge ? "#2E78F5" : "transparent", border: filterBadge ? "none" : "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-adjustments" style={{ fontSize: 15 }} aria-hidden="true" /> Filters
            {filterBadge > 0 && <span style={{ background: "rgba(255,255,255,.28)", borderRadius: 10, padding: "0 6px", fontSize: 10 }}>{filterBadge}</span>}
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} aria-hidden="true" />
          </button>
          {filtersOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 300, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", borderBottom: "0.5px solid #eef1f5" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted-foreground)", marginBottom: 6 }}>Role</div>
                <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  {([["", "Any"], ["founder", "Founder"], ["investor", "Investor"], ["advisor", "Advisor"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => { setRole(val); setOpenFacetKey(null); }} style={{ fontSize: 11.5, fontWeight: role === val ? 600 : 400, color: role === val ? "#fff" : "var(--muted-foreground)", background: role === val ? "#4338CA" : "transparent", border: "none", padding: "4px 10px", cursor: "pointer" }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {roleFacets.map((key) => {
                  const sel = facetSel[key] ?? [];
                  const allOpts = facetOpts[key] ?? [];
                  const opts = allOpts.filter((o) => o.toLowerCase().includes(facetSearch.toLowerCase()));
                  const isOpen = openFacetKey === key;
                  return (
                    <div key={key} style={{ borderBottom: "0.5px solid #f1f5f9" }}>
                      <button onClick={() => { setOpenFacetKey(isOpen ? null : key); setFacetSearch(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, textAlign: "left" }}>
                        <span style={{ flex: 1, color: "var(--foreground)" }}>{FACET_LABEL[key]}</span>
                        {sel.length > 0 && <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "1px 8px" }}>{sel.length}</span>}
                        <i className={isOpen ? "ti ti-chevron-up" : "ti ti-chevron-down"} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div style={{ padding: "0 8px 8px" }}>
                          <input value={facetSearch} onChange={(e) => setFacetSearch(e.target.value)} placeholder="Search…" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 6 }} />
                          <div style={{ maxHeight: 180, overflowY: "auto" }}>
                            {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "4px 6px" }}>{allOpts.length === 0 ? "No options loaded yet." : `No matches for "${facetSearch}".`}</div>}
                            {opts.map((o) => (
                              <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer" }}>
                                <input type="checkbox" checked={sel.includes(o)} onChange={() => toggleFacet(key, o)} style={{ width: 14, height: 14 }} />
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "0.5px solid #eef1f5" }}>
                <button onClick={clearAllFilters} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filterBadge} active</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => { setOpenColPicker((v) => !v); setOpenFilter(null); setFiltersOpen(false); }} style={{ fontSize: 12, color: "var(--foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><i className="ti ti-columns-3" style={{ fontSize: 15 }} aria-hidden="true" /> Columns</button>
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

      {(openFilter || openColPicker || filtersOpen) && <div onClick={() => { setOpenFilter(null); setOpenColPicker(false); setFiltersOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      {canBulkAssign && selectionCount > 0 && (
        <div style={{ background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#0C447C", fontWeight: 500 }}>{selectAllMatching ? `All ${matchingTotal.toLocaleString()} matching selected` : `${selected.size.toLocaleString()} selected`}</span>
            {!selectAllMatching && allLoadedSelected && matchingTotal > selected.size && (
              <button onClick={() => setSelectAllMatching(true)} style={{ fontSize: 12.5, color: "#185FA5", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}>Select all {matchingTotal.toLocaleString()} matching this filter</button>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button onClick={() => { setAssignOpen((v) => !v); setAssignMsg(null); }} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 13px", cursor: "pointer" }}><i className="ti ti-users" aria-hidden="true" /> Lead assign</button>
              <button onClick={clearSelection} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {assignOpen && (
            <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Add members to {selectionCount.toLocaleString()} contact{selectionCount === 1 ? "" : "s"}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 5 }}>Members (lead-assignable only)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, maxHeight: 132, overflowY: "auto" }}>
                {members.length === 0 && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No assignable members configured.</span>}
                {members.map((m) => {
                  const on = assignSel.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => setAssignSel((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])} style={{ fontSize: 11.5, fontWeight: on ? 600 : 400, color: on ? "#185FA5" : "var(--muted-foreground)", background: on ? "#E6F1FB" : "transparent", border: `0.5px solid ${on ? "#B5D4F4" : "var(--border)"}`, borderRadius: 16, padding: "4px 11px", cursor: "pointer" }}>{on ? "✓ " : "+ "}{m.name}</button>
                  );
                })}
              </div>
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: "#854F0B", marginBottom: 10 }}>
                <i className="ti ti-alert-triangle" aria-hidden="true" /> Adds {assignNames.length ? assignNames.join(", ") : "the selected members"} to <b>{selectionCount.toLocaleString()}</b> contact{selectionCount === 1 ? "" : "s"}. Existing assignees are kept. Logged to the audit trail.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={submitAssign} disabled={assignBusy || assignSel.length === 0} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: assignBusy || assignSel.length === 0 ? 0.55 : 1 }}>{assignBusy ? "Assigning…" : `Add to ${selectionCount.toLocaleString()} contact${selectionCount === 1 ? "" : "s"}`}</button>
                <button onClick={() => setAssignOpen(false)} style={{ fontSize: 12.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
                {assignMsg && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{assignMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridColsSel, padding: "9px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          {canBulkAssign && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input type="checkbox" checked={allLoadedSelected || selectAllMatching} onChange={toggleAllLoaded} aria-label="Select all loaded" style={{ width: 14, height: 14, cursor: "pointer" }} />
            </div>
          )}
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
                      {gs!.rows.map((c) => canBulkAssign ? (
                        <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridColsSel, borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: selected.has(c.id) || selectAllMatching ? "#F5F9FF" : undefined }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <input type="checkbox" checked={selected.has(c.id) || selectAllMatching} onChange={() => toggleRow(c.id)} aria-label={`Select ${c.name}`} style={{ width: 14, height: 14, cursor: "pointer" }} />
                          </div>
                          <Link href={`/admin/sales/contacts/${c.id}`} style={{ display: "grid", gridTemplateColumns: gridCols, gridColumn: "2 / -1", padding: "10px 14px", alignItems: "center", textDecoration: "none", color: "var(--foreground)" }}>
                            {visibleColumns.map((col) => <div key={col.key} style={{ minWidth: 0 }}>{renderCell(col.key, c)}</div>)}
                          </Link>
                        </div>
                      ) : (
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
