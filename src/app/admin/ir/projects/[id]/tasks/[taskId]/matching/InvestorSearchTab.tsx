"use client";

/**
 * "Search all investors": the Contacts search, locked to investors. Same search bar
 * (Filters / Group by / Favorites), same server search (useContactsQuery → search_contacts),
 * so the list shows without typing and every filter, group and count matches Contacts.
 * Each loaded page is topped up from /api/admin/ir/investors?ids= with what Contacts
 * doesn't know: sectors, investor type, data source, other projects and this founder's
 * outreach. Favorites are saved under their own scope, apart from Contacts'.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useContactsQuery, PAGE, type SalesContact, type Sort } from "@/app/admin/sales/contacts/useContactsQuery";
import { ContactsSearchBar, CustomFilterDialog, type SavedSearch } from "@/components/admin/sales/ContactsSearchBar";
import { GROUP_BY_OPTIONS } from "@/lib/sales/contact-grouping";
import { INVESTOR_PROFILE_OPTIONS, isListedInvestorProfile } from "@/lib/sales/investor-profile";
import { OP_LABEL, fieldDef, type FilterSpec, type Condition } from "@/lib/sales/contact-filter-spec";
import { COLS, cell, sortRows, SortTh, type ColKey, type Outreach, type Row, type SortKey, type SortState } from "./matching-table";
import { OdooPager } from "@/components/admin/OdooPager";

const SCOPE = "ir-investors";
const NO_GROUP = "profile"; // with the list locked to investors, the role grouping is one group: none
const LOCK: Condition = { field: "type", op: "in", value: ["investor"] };
const EMPTY: FilterSpec = { match: "all", conditions: [] };
/** Headers the server can sort across every match; the rest sort the page on screen. */
const SERVER_SORT: Partial<Record<SortKey, string>> = { name: "name", firm: "company", email: "email" };
const GROUP_OPTS = [{ id: NO_GROUP, label: "None" }, ...GROUP_BY_OPTIONS.filter((o) => o.section !== "profile").map((o) => ({ id: o.id, label: o.id === "company" ? "Firm" : o.label }))];

type Extra = { id: string; sectors?: string[]; types?: string[]; dataSource: string | null; alsoOn: string[]; onThisProject: boolean; founderOutreach: Outreach | null };

export function InvestorSearchTab(p: {
  projectId: string; cols: ColKey[]; picked: Set<string>; setPicked: (f: (s: Set<string>) => Set<string>) => void;
  hideContacted: boolean; sort: SortState; onSort: (k: SortKey) => void; onProfile: (r: Row) => void;
  onRows: (rows: Row[]) => void; tabs: ReactNode; tools: ReactNode;
  /** Group by and open groups carried over from another week by the week pager. */
  initialGroupBy?: string | null; initialOpen?: string[];
  /** Reports the current group by and open groups, so the week pager can carry them over. */
  onView?: (v: { groupBy: string | null; open: string[] }) => void;
}) {
  const carriedGroup = p.initialGroupBy && p.initialGroupBy !== NO_GROUP && GROUP_OPTS.some((o) => o.id === p.initialGroupBy) ? p.initialGroupBy : null;
  const [spec, setSpec] = useState<FilterSpec>(EMPTY);
  const [groupBy, setGroupBy] = useState(carriedGroup ?? NO_GROUP);
  const [typed, setTyped] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [facetOpts, setFacetOpts] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [saveShared, setSaveShared] = useState(false);
  const defaultApplied = useRef(false);

  const fullSpec = useMemo<FilterSpec>(() => ({ match: "all", conditions: [...spec.conditions.filter((c) => c.field !== "type"), LOCK] }), [spec]);
  const serverKey = p.sort ? SERVER_SORT[p.sort.key] : undefined;
  const serverSort: Sort = serverKey && p.sort ? { key: serverKey, dir: p.sort.dir } : { key: "name", dir: "asc" };
  const { groups, expanded, facets, dynGroups, dynLoading, error, toggleGroup, goPage } =
    useContactsQuery({ spec: fullSpec, groupBy, sort: serverSort, viewAs: null, role: "investor" });

  // Facet option lists: same source and Investor profile ordering as Contacts.
  useEffect(() => {
    fetch("/api/sales/contacts/filter-facets").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      const f = d as Record<string, string[]>;
      f.investorTypes = [...INVESTOR_PROFILE_OPTIONS, ...(f.investorTypes ?? []).filter((v) => !isListedInvestorProfile(v))];
      setFacetOpts(f);
    }).catch(() => {});
  }, []);

  // Favorites (own scope) and the caller's default, applied once.
  const fetchSaved = useCallback(async () => {
    try { const r = await fetch(`/api/marketing/saved-searches?scope=${SCOPE}`); if (r.ok) setSaved((await r.json()).searches ?? []); } catch { /* ignore */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state later
  useEffect(() => { void fetchSaved(); }, [fetchSaved]);
  useEffect(() => {
    if (defaultApplied.current) return;
    const def = saved.find((s) => s.isDefault && s.mine);
    if (!def) return;
    defaultApplied.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default apply
    setSpec(def.spec);
    // A group by carried over from another week wins over the saved default's.
    if (def.groupBy && !carriedGroup) setGroupBy(def.groupBy);
  }, [saved, carriedGroup]);

  // ── Spec helpers (same behaviour as the Contacts page) ──
  const same = (a: Condition, b: Condition) => a.field === b.field && a.op === b.op && JSON.stringify(a.value ?? null) === JSON.stringify(b.value ?? null);
  const condLabel = (c: Condition) => {
    const name = fieldDef(c.field)?.label ?? c.field;
    if (c.op === "set" || c.op === "not_set") return `${name} ${OP_LABEL[c.op]}`;
    const vals = Array.isArray(c.value) ? c.value : c.value != null ? [String(c.value)] : [];
    return `${name} ${OP_LABEL[c.op]} ${vals.join(", ")}`;
  };
  const toggleQuick = (cond: Condition) => setSpec((s) => ({ ...s, conditions: s.conditions.some((c) => same(c, cond)) ? s.conditions.filter((c) => !same(c, cond)) : [...s.conditions, cond] }));
  const addCondition = (cond: Condition) => { setSpec((s) => (s.conditions.some((c) => same(c, cond)) ? s : { ...s, conditions: [...s.conditions, cond] })); setTyped(""); setSearchOpen(false); };
  const removeConditionAt = (i: number) => setSpec((s) => ({ ...s, conditions: s.conditions.filter((_, j) => j !== i) }));
  const toggleFacetValue = (field: string, v: string) => setSpec((s) => {
    const idx = s.conditions.findIndex((c) => c.field === field && c.op === "in");
    const cur = idx >= 0 && Array.isArray(s.conditions[idx].value) ? (s.conditions[idx].value as string[]) : [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    const conditions = s.conditions.filter((_, j) => j !== idx);
    if (next.length) conditions.push({ field, op: "in", value: next });
    return { ...s, conditions };
  });
  const facetValueActive = (field: string, v: string) => spec.conditions.some((c) => c.field === field && c.op === "in" && Array.isArray(c.value) && c.value.includes(v));
  const quickActive = (cond: Condition) => spec.conditions.some((c) => same(c, cond));
  const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
  const optionsFor = (source: string | undefined) => source === "countries" ? facets.countries.map((c) => ({ value: c.value, label: c.value })) : source ? (facetOpts[source] ?? []).map((v) => ({ value: v, label: v })) : [];
  async function saveCurrent() {
    if (!saveName.trim()) return;
    try {
      await fetch("/api/marketing/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: saveName.trim(), scope: SCOPE, spec, groupBy, columns: null, isDefault: saveDefault, isShared: saveShared }) });
      setSaveOpen(false); setSaveName(""); setSaveDefault(false); setSaveShared(false); setSearchOpen(false); await fetchSaved();
    } catch { /* ignore */ }
  }
  async function deleteSaved(id: string) {
    try { await fetch(`/api/marketing/saved-searches/${id}`, { method: "DELETE" }); await fetchSaved(); } catch { /* ignore */ }
  }

  // ── Which groups are on screen ──
  const grouped = groupBy !== NO_GROUP;
  const groupList = useMemo(() => grouped ? dynGroups.map((g) => ({ id: g.id, label: g.label, count: g.count })) : [{ id: "investor", label: "", count: facets.counts.investor ?? 0 }], [grouped, dynGroups, facets.counts]);
  const total = facets.counts.investor ?? 0;

  // Reopen the groups that were open on the previous week, once they've loaded.
  const reopened = useRef(false);
  const initialOpen = p.initialOpen;
  useEffect(() => {
    if (reopened.current || !grouped || !dynGroups.length || groupBy !== carriedGroup) return;
    reopened.current = true;
    for (const id of initialOpen ?? []) if (dynGroups.some((g) => g.id === id) && !expanded[id]) toggleGroup(id);
  }, [grouped, dynGroups, groupBy, carriedGroup, initialOpen, expanded, toggleGroup]);
  const { onView } = p;
  const openIds = useMemo(() => (grouped ? Object.keys(expanded).filter((k) => expanded[k]) : []), [grouped, expanded]);
  useEffect(() => { onView?.({ groupBy: grouped ? groupBy : null, open: openIds }); }, [onView, grouped, groupBy, openIds]);

  // ── Top up loaded rows with the IR fields ──
  const [extra, setExtra] = useState<Map<string, Extra>>(new Map());
  const loaded = useMemo(() => groupList.flatMap((g) => groups[g.id]?.rows ?? []), [groupList, groups]);
  useEffect(() => {
    const need = [...new Set(loaded.map((c) => c.id))].filter((id) => !extra.has(id));
    if (!need.length) return;
    let live = true;
    const chunks: string[][] = [];
    for (let i = 0; i < need.length; i += 100) chunks.push(need.slice(i, i + 100));
    void Promise.all(chunks.map((ids) => fetch(`/api/admin/ir/investors?${new URLSearchParams({ ids: ids.join(","), project: p.projectId })}`).then((r) => r.json()).catch(() => ({})))).then((res) => {
      if (!live) return;
      setExtra((m) => { const n = new Map(m); for (const j of res) for (const x of ((j as { investors?: Extra[] }).investors ?? [])) n.set(x.id, x); for (const id of need) if (!n.has(id)) n.set(id, { id, dataSource: null, alsoOn: [], onThisProject: false, founderOutreach: null }); return n; });
    });
    return () => { live = false; };
  }, [loaded, extra, p.projectId]);

  const toRow = useCallback((c: SalesContact): Row => {
    const x = extra.get(c.id);
    return { contactId: c.id, name: c.name, firm: c.company, fit: -1, tier: "low", summary: "Found by search", sectors: x?.sectors ?? [], types: x?.types ?? [], dataSource: x?.dataSource ?? null, alsoOn: x?.alsoOn ?? [], founderOutreach: x?.founderOutreach ?? null, onProject: x?.onThisProject ?? false, email: c.email, phone: c.phone };
  }, [extra]);
  const rowsOf = useCallback((id: string) => {
    const rs = (groups[id]?.rows ?? []).map(toRow).filter((r) => !(p.hideContacted && r.founderOutreach));
    return serverKey ? rs : sortRows(rs, p.sort);
  }, [groups, toRow, p.hideContacted, p.sort, serverKey]);

  const { onRows } = p;
  const allRows = useMemo(() => loaded.map(toRow), [loaded, toRow]);
  useEffect(() => { onRows(allRows); }, [allRows, onRows]);

  const openGroups = grouped ? groupList.filter((g) => expanded[g.id]) : groupList;
  const visibleIds = openGroups.flatMap((g) => rowsOf(g.id)).filter((r) => !r.onProject).map((r) => r.contactId);
  const pickedVisible = visibleIds.filter((id) => p.picked.has(id)).length;
  const allVisible = visibleIds.length > 0 && pickedVisible === visibleIds.length;
  const toggleAll = (on: boolean) => p.setPicked((s) => { const n = new Set(s); for (const id of visibleIds) { if (on) n.add(id); else n.delete(id); } return n; });
  const span = p.cols.length + 2;

  function pager(id: string) {
    const g = groups[id];
    if (!g || g.total <= PAGE) return null;
    return (
      <tr key={`p:${id}`}><td colSpan={span} className="px-3 py-2 text-right">
        {pagerControl(id)}
      </td></tr>
    );
  }
  /** Odoo pager for one group ("1–50 / 7,187 ‹ ›"); shared by the top bar and the table foot so both stay in sync. */
  function pagerControl(id: string) {
    const g = groups[id];
    if (!g || !g.total) return null;
    const from = g.page * PAGE + 1; const to = Math.min(g.total, from + PAGE - 1);
    return <OdooPager label={`${from.toLocaleString()}–${to.toLocaleString()} / ${g.total.toLocaleString()}`}
      prev={{ onClick: () => goPage(id, -1), disabled: g.loading || g.page === 0, title: "Previous page" }}
      next={{ onClick: () => goPage(id, 1), disabled: g.loading || to >= g.total, title: "Next page" }} />;
  }
  function body(id: string) {
    const g = groups[id];
    if (!g || (g.loading && !g.rows.length)) return [<tr key={`l:${id}`}><td colSpan={span} className="px-3 py-4 text-center text-slate-400">Loading…</td></tr>];
    const rs = rowsOf(id);
    if (!rs.length) return [<tr key={`e:${id}`}><td colSpan={span} className="px-3 py-4 text-center text-slate-400">{p.hideContacted && g.rows.length ? "Everyone on this page was already worked for this founder." : "No investors match these filters."}</td></tr>];
    return [...rs.map((r) => (
      <tr key={r.contactId} className={p.picked.has(r.contactId) ? "bg-indigo-50/40" : r.founderOutreach ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-slate-50"}>
        <td className="px-3 py-2"><input type="checkbox" disabled={r.onProject} title={r.onProject ? "Already on this project" : undefined} checked={p.picked.has(r.contactId)} onChange={(e) => p.setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.contactId); else n.delete(r.contactId); return n; })} aria-label={`Select ${r.name ?? r.firm}`} /></td>
        <td className="py-2 pr-2 font-medium text-slate-900">
          <button type="button" onClick={() => p.onProfile(r)} className="text-left hover:text-indigo-700 hover:underline">{r.name ?? r.firm ?? "—"}</button>
          {r.founderOutreach ? <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white" title="Already worked for this founder">!</span> : null}
        </td>
        {p.cols.map((k) => <td key={k} className={k === "why" ? "max-w-[260px] truncate py-2 pr-2 text-slate-500" : "py-2 pr-2 text-slate-600"}>{cell(k, r)}</td>)}
      </tr>
    )), pager(id)];
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {p.tabs}
        <ContactsSearchBar
          spec={spec} typed={typed} setTyped={setTyped} searchOpen={searchOpen} setSearchOpen={setSearchOpen}
          addCondition={addCondition} removeConditionAt={removeConditionAt} condLabel={condLabel}
          toggleQuick={toggleQuick} quickActive={quickActive} firstOfMonth={firstOfMonth}
          groupBy={groupBy} setGroupBy={setGroupBy} groupByLabel={GROUP_OPTS.find((o) => o.id === groupBy)?.label ?? "None"}
          saved={saved} applySaved={(s) => { setSpec(s.spec); setGroupBy(s.groupBy || NO_GROUP); setSearchOpen(false); }} deleteSaved={(id) => void deleteSaved(id)}
          openCustom={() => { setCustomOpen(true); setSearchOpen(false); }} clearAll={() => setSpec(EMPTY)}
          facetOpts={facetOpts} toggleFacetValue={toggleFacetValue} facetValueActive={facetValueActive}
          save={{ open: saveOpen, setOpen: setSaveOpen, name: saveName, setName: setSaveName, isDefault: saveDefault, setDefault: setSaveDefault, shared: saveShared, setShared: setSaveShared, submit: () => void saveCurrent() }}
          hideTypeQuick groupOptions={GROUP_OPTS} noGroupId={NO_GROUP} placeholder="Search investors…"
        />
        {p.tools}
        {!grouped && !dynLoading && groups.investor?.total
          ? <span className="ml-auto">{pagerControl("investor")}</span>
          : <span className="ml-auto text-[12px] text-slate-600">{dynLoading ? "Searching…" : `${total.toLocaleString()} investor${total === 1 ? "" : "s"}`}</span>}
      </div>
      {error ? <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p> : null}
      {grouped ? <p className="mb-3 text-[12px] text-slate-500">Grouped by {GROUP_OPTS.find((o) => o.id === groupBy)?.label.toLowerCase()}. Open a group to load its investors.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500">
            <th className="w-8 px-3 py-2"><input type="checkbox" checked={allVisible} ref={(el) => { if (el) el.indeterminate = pickedVisible > 0 && !allVisible; }} onChange={(e) => toggleAll(e.target.checked)} disabled={!visibleIds.length} aria-label={allVisible ? "Unselect all" : "Select all"} title={allVisible ? "Unselect all" : "Select all"} /></th>
            <SortTh label="Investor" k="name" sort={p.sort} onSort={p.onSort} />
            {p.cols.map((k) => <SortTh key={k} label={COLS.find((c) => c.key === k)?.label ?? k} k={k} sort={p.sort} onSort={p.onSort} />)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {grouped
              ? (dynLoading && !groupList.length ? [<tr key="gl"><td colSpan={span} className="px-3 py-6 text-center text-slate-400">Loading groups…</td></tr>]
                : !groupList.length ? [<tr key="ge"><td colSpan={span} className="px-3 py-6 text-center text-slate-400">No investors match these filters.</td></tr>]
                : groupList.flatMap((g) => [
                  <tr key={`g:${g.id}`} className="cursor-pointer bg-slate-50/70 hover:bg-slate-100" onClick={() => toggleGroup(g.id)}>
                    <td colSpan={span} className="px-3 py-1.5 text-[11.5px] font-semibold text-slate-700">
                      <i className={`ti ti-chevron-${expanded[g.id] ? "down" : "right"} mr-1`} aria-hidden="true" />{g.label} <span className="font-normal text-slate-400">({g.count.toLocaleString()})</span>
                    </td>
                  </tr>,
                  ...(expanded[g.id] ? body(g.id) : []),
                ]))
              : body("investor")}
          </tbody>
        </table>
      </div>
      {p.sort && !serverKey ? <p className="mt-2 text-[11.5px] text-slate-500">Sorting by {COLS.find((c) => c.key === p.sort!.key)?.label.toLowerCase()} orders the investors on this page. Investor, Firm and Email sort across every match.</p> : null}
      {customOpen ? <CustomFilterDialog spec={spec} optionsFor={optionsFor} excludeFields={["type"]} matchAllOnly onClose={() => setCustomOpen(false)} onApply={(s) => { setSpec(s); setCustomOpen(false); }} /> : null}
    </>
  );
}
