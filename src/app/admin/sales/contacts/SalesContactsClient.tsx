"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GROUP_BY_OPTIONS, type GroupSection } from "@/lib/sales/contact-grouping";
import { FIELD_REGISTRY, OP_LABEL, fieldDef, type FilterSpec, type Condition, type Operator, type OptionSource } from "@/lib/sales/contact-filter-spec";
import { MassEmailComposer, type SelectionPayload } from "@/components/marketing/MassEmailComposer";

type SavedSearch = { id: string; name: string; spec: FilterSpec; groupBy: string | null; columns: string[] | null; isDefault: boolean; isShared: boolean; mine: boolean; ownerName?: string; canDelete?: boolean };

const GROUP_BY_SECTIONS: { key: GroupSection; label: string }[] = [
  { key: "profile", label: "Profile & role" },
  { key: "facets", label: "Questionnaire facets" },
  { key: "crm", label: "CRM fields" },
];

export type LastMessage = { direction: "sent" | "reply" | "note"; text: string; at: string };
export type NextActivity = { type: string; title: string; due: string | null; state: "overdue" | "today" | "planned" | "done" | "none" };
export type SalesContact = { id: string; name: string; email: string; company: string; phone: string; source: string; type: string; country: string; createdOn: string; leadSource?: string; assignees?: string[]; lastMessage?: LastMessage | null; activity?: NextActivity | null };
type GroupState = { rows: SalesContact[]; total: number; loading: boolean; loaded: boolean; page: number };
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
  { key: "last_message", label: "Last message", width: "1.7fr", kind: "none", sortable: false },
  { key: "activities", label: "Activities", width: "1.3fr", kind: "none", sortable: false },
  { key: "lead_assign", label: "Lead assign", width: "1.1fr", kind: "none", sortable: false },
  { key: "lead_source", label: "Lead source", width: "120px", kind: "none", sortable: false },
  { key: "country", label: "Country", width: "100px", kind: "country", sortable: true },
  { key: "created_on", label: "Created on", width: "104px", kind: "none", sortable: true },
];

const TYPE_BADGE: Record<string, { t: string; c: string; bg: string }> = {
  founder: { t: "Founder", c: "#712B13", bg: "#FAECE7" },
  investor: { t: "Investor", c: "#0C447C", bg: "#E6F1FB" },
  advisor: { t: "Advisor", c: "#633806", bg: "#FAEEDA" },
  other: { t: "Other", c: "#444441", bg: "#F1EFE8" },
};

const MSG_DIR: Record<string, { label: string; icon: string; color: string }> = {
  sent: { label: "Sent", icon: "ti-arrow-up-right", color: "#185FA5" },
  reply: { label: "Reply", icon: "ti-arrow-down-left", color: "#0F6E56" },
  note: { label: "Note", icon: "ti-note", color: "#854F0B" },
};

function relTime(at: string): string {
  if (!at) return "";
  const ms = Date.now() - new Date(at).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const day = 86_400_000;
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  if (ms < day) return `${Math.round(ms / 3_600_000)}h ago`;
  if (ms < 7 * day) return `${Math.round(ms / day)}d ago`;
  if (ms < 30 * day) return `${Math.round(ms / (7 * day))}w ago`;
  return new Date(at).toISOString().slice(0, 10);
}

type FacetKey = "leadSource" | "industries" | "capital" | "fundingStages" | "investorTypes" | "operatingStages";
const FACET_LABEL: Record<FacetKey, string> = {
  leadSource: "Lead source",
  industries: "Type of industries",
  capital: "Amount / type of capital",
  fundingStages: "Funding stage",
  investorTypes: "Investor type",
  operatingStages: "Operating stage",
};
const FACETS_BY_ROLE: Record<string, FacetKey[]> = {
  founder: ["leadSource", "industries", "capital", "fundingStages", "operatingStages"],
  investor: ["leadSource", "investorTypes", "industries", "capital", "fundingStages", "operatingStages"],
  advisor: ["leadSource", "industries"],
  any: ["leadSource", "industries", "capital", "fundingStages", "investorTypes", "operatingStages"],
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

function buildParams(q: string, tf: TextFilters, countries: string[], sort: Sort, facetSel: Record<string, string[]>, spec?: FilterSpec): string {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  (["name", "company", "email", "phone"] as const).forEach((k) => { if (tf[k].trim()) sp.set(k, tf[k].trim()); });
  if (countries.length) sp.set("country", countries.join(","));
  if (sort.key !== "name" || sort.dir !== "asc") { sp.set("sort", sort.key); sp.set("dir", sort.dir); }
  for (const [key, vals] of Object.entries(facetSel)) for (const v of vals) if (v) sp.append(key, v);
  // Odoo-style custom filter spec (Marketing). Serialized as one `filter` param.
  if (spec && spec.conditions.length) sp.set("filter", JSON.stringify(spec));
  return sp.toString();
}

const LIST_DEPARTMENTS = ["Marketing", "Sales", "Investor Relations", "Administration", "Events"] as const;

const LEAD_SOURCE_OPTS = ["LinkedIn", "Referral", "Website", "Event", "Conference", "Cold outreach", "Email campaign", "Partner", "Inbound", "Webinar", "Other"];

export function SalesContactsClient({ canBulkAssign = false, canCreateList = false, canBulkEdit = false, canExport = false, odooSearch = false, basePath = "/admin/sales/contacts" }: { canBulkAssign?: boolean; canCreateList?: boolean; canBulkEdit?: boolean; canExport?: boolean; odooSearch?: boolean; basePath?: string }) {
  const [q, setQ] = useState("");
  const [textFilters, setTextFilters] = useState<TextFilters>({ name: "", company: "", email: "", phone: "" });
  const [countries, setCountries] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(() => loadLS<Sort>("salesContacts.sort", { key: "name", dir: "asc" }));
  // v5 key: bumped when the "Activities" column was added (v4 for "Lead source") so a
  // stale saved set from before the column existed doesn't hide it. Resets prefs once.
  const [visibleCols, setVisibleCols] = useState<string[]>(() => loadLS<string[]>("salesContacts.cols.v5", ALL_COLUMNS.map((c) => c.key)));

  const [facets, setFacets] = useState<Facets>({ counts: {}, countries: [] });
  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Mirror `expanded` into a ref so loadAll can read which groups are open without
  // re-running the load effect every time a group is toggled.
  const expandedRef = useRef(expanded);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  // Group by dimension. "profile" keeps the original role-group behaviour; any
  // other dimension uses the dynamic group list from /groups.
  const [groupBy, setGroupBy] = useState<string>(() => loadLS<string>("salesContacts.groupBy", "profile"));
  const [groupByOpen, setGroupByOpen] = useState(false);
  const [dynGroups, setDynGroups] = useState<{ id: string; label: string; count: number }[]>([]);
  const [dynLoading, setDynLoading] = useState(false);
  const groupByRef = useRef(groupBy);
  useEffect(() => { groupByRef.current = groupBy; try { window.localStorage.setItem("salesContacts.groupBy", JSON.stringify(groupBy)); } catch { /* ignore */ } }, [groupBy]);
  const groupByLabel = GROUP_BY_OPTIONS.find((o) => o.id === groupBy)?.label ?? "Profile";

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [openColPicker, setOpenColPicker] = useState(false);
  const [draft, setDraft] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  // Role + questionnaire facet filters (Odoo-style Filters dropdown).
  const [role, setRole] = useState<"" | "founder" | "investor" | "advisor">("");
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);
  const [facetSel, setFacetSel] = useState<Record<string, string[]>>({});
  const [facetOpts, setFacetOpts] = useState<Record<string, string[]>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFacetKey, setOpenFacetKey] = useState<string | null>(null);
  const [facetSearch, setFacetSearch] = useState("");

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", email: "", company: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Selection (Lead assign is super-admin-only; Create list is enabled per-page).
  const canSelect = canBulkAssign || canCreateList || canBulkEdit || canExport;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  // Odoo-style Actions menu over the selection.
  const [actionsOpen, setActionsOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceVal, setSourceVal] = useState<string>(LEAD_SOURCE_OPTS[0]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceMsg, setSourceMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSel, setAssignSel] = useState<string[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  // Create list from selection (Marketing).
  const [listOpen, setListOpen] = useState(false);
  const [listMode, setListMode] = useState<"new" | "existing">("new");
  const [listName, setListName] = useState("");
  const [listDept, setListDept] = useState<string>("Marketing");
  const [listDesc, setListDesc] = useState("");
  const [existingLists, setExistingLists] = useState<{ id: string; name: string; contact_count?: number }[]>([]);
  const [addToListId, setAddToListId] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [listMsg, setListMsg] = useState<string | null>(null);
  const [listResult, setListResult] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  // Odoo-style search (Marketing): a field·operator·value spec drives the query.
  const [spec, setSpec] = useState<FilterSpec>({ match: "all", conditions: [] });
  const [typed, setTyped] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftSpec, setDraftSpec] = useState<FilterSpec>({ match: "all", conditions: [] });
  const [valuePickerAt, setValuePickerAt] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [saveShared, setSaveShared] = useState(false);
  const defaultApplied = useRef(false);

  const viewAs = useSearchParams().get("viewAs");
  const viewQ = viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : "";
  const paramsStr = useMemo(() => buildParams(q, textFilters, countries, sort, facetSel, odooSearch ? spec : undefined), [q, textFilters, countries, sort, facetSel, odooSearch, spec]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => c.always || visibleCols.includes(c.key)), [visibleCols]);
  const gridCols = useMemo(() => visibleColumns.map((c) => c.width).join(" "), [visibleColumns]);
  const gridColsSel = canSelect ? `34px ${gridCols}` : gridCols;

  useEffect(() => { try { window.localStorage.setItem("salesContacts.cols.v5", JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);
  useEffect(() => { try { window.localStorage.setItem("salesContacts.sort", JSON.stringify(sort)); } catch { /* ignore */ } }, [sort]);

  // Fetch one group's first page. Groups render collapsed by default, so we only
  // pay for a group's rows (its exact count + name-sort + last-message lookups)
  // once it's actually opened — the header counts come from the cheap facets call.
  // URL fragment selecting one group: role groups use ?group=, every other
  // dimension uses ?groupBy=&groupValue=. Reads groupBy from a ref so callbacks
  // don't need to be re-created when the dimension changes.
  const groupFrag = (id: string) => groupByRef.current === "profile"
    ? `group=${id}`
    : `groupBy=${encodeURIComponent(groupByRef.current)}&groupValue=${encodeURIComponent(id)}${roleRef.current ? `&group=${roleRef.current}` : ""}`;

  const loadGroup = useCallback(async (id: string, params: string) => {
    setGroups((prev) => ({ ...prev, [id]: { rows: prev[id]?.rows ?? [], total: prev[id]?.total ?? 0, loading: true, loaded: prev[id]?.loaded ?? false, page: 0 } }));
    try {
      const res = await fetch(`/api/sales/contacts?${groupFrag(id)}&offset=0&limit=${PAGE}${params ? `&${params}` : ""}${viewQ}`);
      const data = res.ok ? await res.json() : { contacts: [], total: 0 };
      setGroups((prev) => ({ ...prev, [id]: { rows: data.contacts ?? [], total: data.total ?? 0, loading: false, loaded: true, page: 0 } }));
    } catch { setGroups((prev) => ({ ...prev, [id]: { rows: [], total: 0, loading: false, loaded: true, page: 0 } })); }
  }, [viewQ]);

  // On mount / filter change: only (re)load groups that are currently open (plus the
  // active role filter). Collapsed groups are reset so re-opening refetches fresh.
  const loadAll = useCallback(async (params: string, roleFilter: string) => {
    const isOpen = (id: string) => !!expandedRef.current[id] || id === roleFilter;
    const willLoad = (id: string) => (!roleFilter || id === roleFilter) && isOpen(id);
    setGroups((prev) => {
      const next: Record<string, GroupState> = {};
      for (const g of GROUP_DEFS) next[g.id] = willLoad(g.id)
        ? { rows: prev[g.id]?.rows ?? [], total: prev[g.id]?.total ?? 0, loading: true, loaded: false, page: 0 }
        : { rows: [], total: 0, loading: false, loaded: false, page: 0 };
      return next;
    });
    await Promise.all(GROUP_DEFS.filter((g) => willLoad(g.id)).map((g) => loadGroup(g.id, params)));
  }, [loadGroup]);

  const loadFacets = useCallback(async (params: string) => {
    try {
      const qs = [params, viewAs ? `viewAs=${encodeURIComponent(viewAs)}` : ""].filter(Boolean).join("&");
      const res = await fetch(`/api/sales/contacts/facets${qs ? `?${qs}` : ""}`);
      if (res.ok) setFacets(await res.json());
    } catch { /* ignore */ }
  }, [viewAs]);

  // Group list for a non-profile dimension (headers + counts). Role, if set, is
  // passed as ?group= so "Investors grouped by industry" narrows correctly.
  const loadDynGroups = useCallback(async (params: string, by: string, roleFilter: string) => {
    setDynLoading(true);
    try {
      const qs = [`by=${encodeURIComponent(by)}`, roleFilter ? `group=${roleFilter}` : "", params, viewAs ? `viewAs=${encodeURIComponent(viewAs)}` : ""].filter(Boolean).join("&");
      const res = await fetch(`/api/sales/contacts/groups?${qs}`);
      const data = res.ok ? await res.json() : { groups: [] };
      setDynGroups((data.groups ?? []) as { id: string; label: string; count: number }[]);
    } catch { setDynGroups([]); } finally { setDynLoading(false); }
  }, [viewAs]);

  // Filtering to a single role opens that group so its results are visible (and load).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- open the filtered group
  useEffect(() => { if (role) setExpanded((e) => (e[role] ? e : { ...e, [role]: true })); }, [role]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (groupBy === "profile") void loadAll(paramsStr, role);
      else void loadDynGroups(paramsStr, groupBy, role);
      void loadFacets(paramsStr);
    }, 300);
    return () => clearTimeout(t);
  }, [paramsStr, role, groupBy, loadAll, loadDynGroups, loadFacets]);

  // Switching the group-by dimension resets open groups + their cached rows so
  // the new grouping starts clean (all collapsed).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset groups when dimension changes
  useEffect(() => { setExpanded({}); setGroups({}); }, [groupBy]);

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
  useEffect(() => { setSelected(new Set()); setSelectAllMatching(false); setAssignOpen(false); setListOpen(false); setListResult(null); setSourceOpen(false); setActionsOpen(false); }, [paramsStr, role, groupBy]);

  // Open/close a group. Opening one that hasn't been loaded yet (or is mid-load)
  // triggers its first fetch — this is what defers the cost off the initial render.
  function toggleGroup(id: string) {
    const opening = !expanded[id];
    if (opening) {
      const gs = groups[id];
      if (!gs?.loaded && !gs?.loading) void loadGroup(id, paramsStr);
    }
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  // Odoo-style paging: jump to a page and REPLACE the visible rows (no append).
  async function goPage(groupId: string, delta: number) {
    const gs = groups[groupId];
    if (!gs) return;
    const totalPages = Math.max(1, Math.ceil(gs.total / PAGE));
    const nextPage = Math.min(Math.max(0, gs.page + delta), totalPages - 1);
    if (nextPage === gs.page) return;
    setGroups((prev) => ({ ...prev, [groupId]: { ...prev[groupId], loading: true } }));
    try {
      const res = await fetch(`/api/sales/contacts?${groupFrag(groupId)}&offset=${nextPage * PAGE}&limit=${PAGE}${paramsStr ? `&${paramsStr}` : ""}${viewQ}`);
      const data = res.ok ? await res.json() : { contacts: [], total: gs.total };
      setGroups((prev) => ({ ...prev, [groupId]: { ...prev[groupId], rows: data.contacts ?? [], total: data.total ?? prev[groupId].total, loading: false, page: nextPage } }));
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

  // ── Odoo-style search helpers ─────────────────────────────────────────────
  const TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "investor", label: "Investor" }, { value: "founder", label: "Founder" }, { value: "advisor", label: "Advisor" }, { value: "other", label: "Other" },
  ];
  function optionsFor(source: OptionSource | undefined): { value: string; label: string }[] {
    if (source === "countries") return facets.countries.map((c) => ({ value: c.value, label: c.value }));
    if (source === "type") return TYPE_OPTIONS;
    if (source) return (facetOpts[source] ?? []).map((v) => ({ value: v, label: v }));
    return [];
  }
  function condLabel(c: Condition): string {
    const def = fieldDef(c.field);
    const name = def?.label ?? c.field;
    if (c.op === "set" || c.op === "not_set") return `${name} ${OP_LABEL[c.op]}`;
    const raw = Array.isArray(c.value) ? c.value : c.value != null ? [String(c.value)] : [];
    const vals = def?.options === "type" ? raw.map((v) => TYPE_OPTIONS.find((t) => t.value === v)?.label ?? v) : raw;
    return `${name} ${OP_LABEL[c.op]} ${vals.join(", ")}`;
  }
  const sameCond = (a: Condition, b: Condition) => a.field === b.field && a.op === b.op && JSON.stringify(a.value ?? null) === JSON.stringify(b.value ?? null);
  function toggleQuick(cond: Condition) {
    setSpec((s) => {
      const exists = s.conditions.some((c) => sameCond(c, cond));
      return { ...s, conditions: exists ? s.conditions.filter((c) => !sameCond(c, cond)) : [...s.conditions, cond] };
    });
  }
  function addCondition(cond: Condition) {
    setSpec((s) => (s.conditions.some((c) => sameCond(c, cond)) ? s : { ...s, conditions: [...s.conditions, cond] }));
    setTyped(""); setSearchOpen(false);
  }
  function removeConditionAt(i: number) { setSpec((s) => ({ ...s, conditions: s.conditions.filter((_, j) => j !== i) })); }
  // Facet checkbox in the dropdown: one "in" condition per field, values toggled inside it.
  function toggleFacetValue(field: string, v: string) {
    setSpec((s) => {
      const idx = s.conditions.findIndex((c) => c.field === field && c.op === "in");
      const cur = idx >= 0 && Array.isArray(s.conditions[idx].value) ? (s.conditions[idx].value as string[]) : [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      const conditions = s.conditions.filter((_, j) => j !== idx);
      if (next.length) conditions.push({ field, op: "in", value: next });
      return { ...s, conditions };
    });
  }
  const facetValueActive = (field: string, v: string) => spec.conditions.some((c) => c.field === field && c.op === "in" && Array.isArray(c.value) && c.value.includes(v));
  const quickActive = (cond: Condition) => spec.conditions.some((c) => sameCond(c, cond));
  const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

  const fetchSaved = useCallback(async () => {
    try { const r = await fetch("/api/marketing/saved-searches"); if (r.ok) setSaved((await r.json()).searches ?? []); } catch { /* ignore */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state later
  useEffect(() => { if (odooSearch) void fetchSaved(); }, [odooSearch, fetchSaved]);
  // Apply the owner's default saved search once on first load.
  useEffect(() => {
    if (!odooSearch || defaultApplied.current) return;
    const def = saved.find((s) => s.isDefault && s.mine);
    if (!def) return;
    defaultApplied.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default apply
    setSpec(def.spec);
    if (def.groupBy) setGroupBy(def.groupBy);
    if (def.columns?.length) setVisibleCols(def.columns);
  }, [odooSearch, saved]);
  function applySaved(s: SavedSearch) {
    setSpec(s.spec); setGroupBy(s.groupBy || "profile"); if (s.columns?.length) setVisibleCols(s.columns); setSearchOpen(false);
  }
  async function deleteSaved(id: string) {
    try { await fetch(`/api/marketing/saved-searches/${id}`, { method: "DELETE" }); await fetchSaved(); } catch { /* ignore */ }
  }
  async function saveCurrent() {
    if (!saveName.trim()) return;
    try {
      await fetch("/api/marketing/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: saveName.trim(), spec, groupBy, columns: visibleCols, isDefault: saveDefault, isShared: saveShared }) });
      setSaveOpen(false); setSaveName(""); setSaveDefault(false); setSaveShared(false); setSearchOpen(false); await fetchSaved();
    } catch { /* ignore */ }
  }
  function openCustom() { setDraftSpec({ match: spec.match, conditions: spec.conditions.length ? spec.conditions : [{ field: "name", op: "contains", value: "" }] }); setValuePickerAt(null); setCustomOpen(true); setSearchOpen(false); }
  function applyCustom() { setSpec({ match: draftSpec.match, conditions: draftSpec.conditions.filter((c) => fieldDef(c.field)) }); setCustomOpen(false); }
  function updateDraftAt(i: number, patch: Partial<Condition>) {
    setDraftSpec((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }
  function changeDraftField(i: number, field: string) {
    const def = fieldDef(field); const op = (def?.ops[0] ?? "contains") as Operator;
    updateDraftAt(i, { field, op, value: op === "in" ? [] : "" });
  }
  function changeDraftOp(i: number, op: Operator) {
    updateDraftAt(i, { op, value: op === "in" ? [] : op === "set" || op === "not_set" ? undefined : "" });
  }
  function toggleDraftValue(i: number, v: string) {
    setDraftSpec((d) => ({ ...d, conditions: d.conditions.map((c, j) => {
      if (j !== i) return c;
      const cur = Array.isArray(c.value) ? c.value : [];
      return { ...c, value: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    }) }));
  }
  function addDraftRow() { setDraftSpec((d) => ({ ...d, conditions: [...d.conditions, { field: "name", op: "contains" as Operator, value: "" }] })); }
  function removeDraftRow(i: number) { setDraftSpec((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) })); }

  // ── Mass Lead assign helpers ──────────────────────────────────────────────
  const activeGroupIds = useMemo(() => (groupBy === "profile" ? GROUP_DEFS.map((g) => g.id) : dynGroups.map((g) => g.id)), [groupBy, dynGroups]);
  const allLoadedIds = useMemo(() => activeGroupIds.flatMap((id) => (groups[id]?.rows ?? []).map((r) => r.id)), [activeGroupIds, groups]);
  const dynTotal = useMemo(() => dynGroups.reduce((a, g) => a + g.count, 0), [dynGroups]);
  const matchingTotal = groupBy === "profile" ? (role ? (facets.counts[role] ?? 0) : (facets.counts.total ?? 0)) : dynTotal;
  const selectionCount = selectAllMatching ? matchingTotal : selected.size;
  const allLoadedSelected = allLoadedIds.length > 0 && allLoadedIds.every((id) => selected.has(id));
  function toggleRow(id: string) { setSelectAllMatching(false); setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAllLoaded() { setSelectAllMatching(false); setSelected(allLoadedSelected ? new Set() : new Set(allLoadedIds)); }
  function clearSelection() { setSelected(new Set()); setSelectAllMatching(false); setAssignOpen(false); setAssignMsg(null); setListOpen(false); setListMsg(null); setSourceOpen(false); setSourceMsg(null); setActionsOpen(false); }
  // Selection → request target. "Select all" carries the filter, not the ids, so the
  // action touches every matching contact — the number the bar shows.
  const selectionTarget = () => selectAllMatching
    ? { mode: "filter" as const, params: paramsStr, group: role || undefined }
    : { mode: "ids" as const, ids: [...selected] };
  function closePanels() { setAssignOpen(false); setListOpen(false); setSourceOpen(false); setActionsOpen(false); }

  async function submitSetSource() {
    setSourceBusy(true); setSourceMsg(null);
    try {
      let count = 0, failed = 0;
      let afterId: string | undefined;
      // Server writes ≤1,500 per request and hands back a cursor; keep going until done.
      for (let pass = 0; pass < 40; pass++) {
        const res = await fetch("/api/sales/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "set_lead_source", value: sourceVal, afterId, ...selectionTarget() }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't set the lead source.");
        count += data.count; failed += data.failed ?? 0;
        if (!data.nextCursor) break;
        afterId = data.nextCursor;
        setSourceMsg(`Working… ${count.toLocaleString()} done, ${data.remaining.toLocaleString()} to go`);
      }
      setActionResult(`Lead source set to “${sourceVal}” on ${count.toLocaleString()} contact${count === 1 ? "" : "s"}${failed ? ` — ${failed} failed` : ""}.`);
      clearSelection();
      await Promise.all([loadAll(paramsStr, role), loadFacets(paramsStr)]);
    } catch (e) { setSourceMsg(e instanceof Error ? e.message : "Couldn't set the lead source."); } finally { setSourceBusy(false); }
  }

  async function exportCsv() {
    setExportBusy(true); setActionsOpen(false);
    try {
      const res = await fetch("/api/sales/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "export", ...selectionTarget() }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Export failed."); }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "contacts.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setActionResult(`Exported ${selectionCount.toLocaleString()} contact${selectionCount === 1 ? "" : "s"} to ${name}.`);
    } catch (e) { setActionResult(e instanceof Error ? e.message : "Export failed."); } finally { setExportBusy(false); }
  }

  // Create a Marketing list from the selection (or append to an existing one).
  function openListPanel() {
    setListOpen((v) => !v); setListMsg(null); setAssignOpen(false);
    if (existingLists.length === 0) {
      fetch("/api/marketing/lists").then((r) => (r.ok ? r.json() : [])).then((d) => setExistingLists(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }
  async function submitCreateList() {
    const isNew = listMode === "new";
    if (isNew && !listName.trim()) { setListMsg("Give the list a name."); return; }
    if (!isNew && !addToListId) { setListMsg("Pick a list to add to."); return; }
    setListBusy(true); setListMsg(null);
    try {
      const target = selectAllMatching
        ? { mode: "filter" as const, params: paramsStr, group: role || undefined }
        : { mode: "ids" as const, ids: [...selected] };
      const dest = isNew
        ? { name: listName.trim(), department: listDept, description: listDesc.trim() || undefined }
        : { listId: addToListId };
      const res = await fetch("/api/marketing/lists/from-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, ...dest }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the list.");
      setListResult(`${data.created ? "Created list" : "Updated list"} “${data.listName}” — ${data.added.toLocaleString()} contact${data.added === 1 ? "" : "s"} added${data.skippedNoEmail ? `, ${data.skippedNoEmail.toLocaleString()} skipped (no email)` : ""}.`);
      setListName(""); setListDesc(""); setAddToListId("");
      clearSelection();
      fetch("/api/marketing/lists").then((r) => (r.ok ? r.json() : [])).then((d) => setExistingLists(Array.isArray(d) ? d : [])).catch(() => {});
    } catch (e) { setListMsg(e instanceof Error ? e.message : "Couldn't create the list."); } finally { setListBusy(false); }
  }
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
      case "last_message": {
        const lm = c.lastMessage;
        if (!lm) return <div style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>—</div>;
        const meta = MSG_DIR[lm.direction] ?? MSG_DIR.note;
        const rel = relTime(lm.at);
        return (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, color: meta.color, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3 }}><i className={`ti ${meta.icon}`} aria-hidden="true" />{meta.label}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--foreground)" }}>{lm.text}</span>
            {rel && <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--muted-foreground)", fontSize: 11 }}>{rel}</span>}
          </div>
        );
      }
      case "activities": {
        const a = c.activity;
        if (!a || a.state === "none") return <div style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>—</div>;
        const today = new Date().toISOString().slice(0, 10);
        const when = a.state === "done" ? "Done" : !a.due ? "No date" : a.state === "today" ? "Today"
          : a.state === "overdue" ? `${Math.round((Date.parse(today) - Date.parse(a.due)) / 86400000)}d overdue` : a.due;
        const color = a.state === "overdue" ? "#A32D2D" : a.state === "today" ? "#854F0B" : a.state === "done" ? "#0F6E56" : "#3B6D11";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, fontSize: 11.5 }} title={`${a.type}: ${a.title}${a.due ? ` · ${a.due}` : ""}`}>
            <i className={`ti ${a.state === "done" ? "ti-check" : "ti-clock"}`} style={{ color, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ color, flexShrink: 0 }}>{a.type}</span>
            <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {when}{a.title ? ` · ${a.title}` : ""}</span>
          </div>
        );
      }
      case "lead_assign": return c.assignees && c.assignees.length ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", overflow: "hidden" }}>
          {c.assignees.slice(0, 2).map((n) => <span key={n} style={{ fontSize: 10, background: "#E6F1FB", color: "#185FA5", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>{n}</span>)}
          {c.assignees.length > 2 && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>+{c.assignees.length - 2}</span>}
        </div>
      ) : <div style={{ color: "var(--muted-foreground)" }}>—</div>;
      case "lead_source": return c.leadSource ? (
        <span style={{ fontSize: 10, background: "#E6F1FB", color: "#185FA5", borderRadius: 10, padding: "1px 8px", whiteSpace: "nowrap" }}>{c.leadSource}</span>
      ) : <div style={{ color: "var(--muted-foreground)" }}>—</div>;
      case "country": return <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.country || "—"}</div>;
      case "created_on": return <div style={{ color: "var(--muted-foreground)", fontSize: 11.5, whiteSpace: "nowrap" }}>{c.createdOn ? c.createdOn.slice(0, 10) : "—"}</div>;
      default: return null;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {odooSearch ? (
          <OdooSearchBar
            spec={spec} typed={typed} setTyped={setTyped} searchOpen={searchOpen} setSearchOpen={setSearchOpen}
            addCondition={addCondition} removeConditionAt={removeConditionAt} condLabel={condLabel}
            toggleQuick={toggleQuick} quickActive={quickActive} firstOfMonth={firstOfMonth}
            groupBy={groupBy} setGroupBy={setGroupBy} groupByLabel={groupByLabel}
            saved={saved} applySaved={applySaved} deleteSaved={deleteSaved}
            openCustom={openCustom}
            clearAll={() => setSpec({ match: "all", conditions: [] })}
            facetOpts={facetOpts} toggleFacetValue={toggleFacetValue} facetValueActive={facetValueActive}
            save={{ open: saveOpen, setOpen: setSaveOpen, name: saveName, setName: setSaveName, isDefault: saveDefault, setDefault: setSaveDefault, shared: saveShared, setShared: setSaveShared, submit: saveCurrent }}
          />
        ) : (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, phone…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        )}
        {!odooSearch && activeFilters > 0 && (
          <button onClick={() => { setTextFilters({ name: "", company: "", email: "", phone: "" }); setCountries([]); }} style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}</button>
        )}
        <div style={{ position: "relative", display: odooSearch ? "none" : undefined }}>
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
        <div style={{ position: "relative", display: odooSearch ? "none" : undefined }}>
          <button onClick={() => { setGroupByOpen((v) => !v); setOpenColPicker(false); setFiltersOpen(false); setOpenFilter(null); }} style={{ fontSize: 12, fontWeight: 500, color: groupBy !== "profile" ? "#fff" : "var(--foreground)", background: groupBy !== "profile" ? "#2E78F5" : "transparent", border: groupBy !== "profile" ? "none" : "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-layout-list" style={{ fontSize: 15 }} aria-hidden="true" /> Group by: {groupByLabel}
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} aria-hidden="true" />
          </button>
          {groupByOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 250, maxHeight: 420, overflowY: "auto", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "6px 0" }}>
              {GROUP_BY_SECTIONS.map((sec) => {
                const opts = GROUP_BY_OPTIONS.filter((o) => o.section === sec.key && o.id !== "profile");
                const rows = sec.key === "profile" ? GROUP_BY_OPTIONS.filter((o) => o.id === "profile") : opts;
                if (rows.length === 0) return null;
                return (
                  <div key={sec.key}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "8px 13px 3px", background: "var(--muted)" }}>{sec.label}</div>
                    {rows.map((o) => (
                      <button key={o.id} onClick={() => { setGroupBy(o.id); setGroupByOpen(false); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", background: groupBy === o.id ? "#EEF0F4" : "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                        {o.id === "profile" ? "Profile (Investor / Founder / Advisor)" : o.label}
                        {groupBy === o.id && <i className="ti ti-check" style={{ marginLeft: "auto", color: "#185FA5" }} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                );
              })}
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
            <button onClick={() => { setAdding(false); setErr(null); }} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
          </div>
          {err && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#A32D2D" }}>{err}</div>}
        </div>
      )}

      {(openFilter || openColPicker || filtersOpen || groupByOpen || actionsOpen) && <div onClick={() => { setOpenFilter(null); setOpenColPicker(false); setFiltersOpen(false); setGroupByOpen(false); setActionsOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      {/* Custom filter builder (Odoo) */}
      {customOpen && (
        <div onClick={() => setCustomOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, width: 620, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add custom filter</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
              Match{" "}
              <select value={draftSpec.match} onChange={(e) => setDraftSpec((d) => ({ ...d, match: e.target.value as "all" | "any" }))} style={{ ...inp, padding: "3px 7px" }}>
                <option value="all">all</option><option value="any">any</option>
              </select>{" "}of the following:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {draftSpec.conditions.map((c, i) => {
                const def = fieldDef(c.field);
                const needsValue = c.op !== "set" && c.op !== "not_set";
                const isMulti = c.op === "in";
                const isDate = def?.kind === "date";
                const opts = optionsFor(def?.options);
                return (
                  <div key={i} style={{ border: "0.5px solid #e2e6ed", borderRadius: 9, padding: 10 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select value={c.field} onChange={(e) => changeDraftField(i, e.target.value)} style={{ ...inp, flex: 1.2 }}>
                        {FIELD_REGISTRY.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                      <select value={c.op} onChange={(e) => changeDraftOp(i, e.target.value as Operator)} style={{ ...inp, flex: 1 }}>
                        {(def?.ops ?? []).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                      </select>
                      <button onClick={() => removeDraftRow(i)} style={{ border: "0.5px solid #F0C0C0", color: "#A32D2D", background: "#fff", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }}>×</button>
                    </div>
                    {needsValue && (
                      <div style={{ marginTop: 8 }}>
                        {isMulti ? (
                          <div style={{ maxHeight: 132, overflowY: "auto", border: "0.5px solid #e2e6ed", borderRadius: 7, padding: 6 }}>
                            {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: 4 }}>No options.</div>}
                            {opts.map((o) => {
                              const checked = Array.isArray(c.value) && c.value.includes(o.value);
                              return (
                                <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", fontSize: 12, cursor: "pointer" }}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleDraftValue(i, o.value)} style={{ width: 13, height: 13 }} />
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <input type={isDate ? "date" : "text"} value={typeof c.value === "string" ? c.value : ""} onChange={(e) => updateDraftAt(i, { value: e.target.value })} placeholder="Value…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addDraftRow} style={{ marginTop: 10, fontSize: 12, color: "#2E78F5", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>＋ New condition</button>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setCustomOpen(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
              <button onClick={applyCustom} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {emailOpen && (
        <MassEmailComposer
          source="contacts"
          selection={selectAllMatching
            ? { mode: "filter", params: paramsStr, group: role || undefined, count: matchingTotal }
            : { mode: "ids", ids: [...selected], count: selected.size }}
          onClose={() => setEmailOpen(false)}
        />
      )}

      {canCreateList && listResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E1F5EE", border: "0.5px solid #A7E0CE", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
          <i className="ti ti-circle-check" style={{ color: "#0F6E56" }} aria-hidden="true" />
          <span style={{ fontSize: 12.5, color: "#0F6E56", fontWeight: 500 }}>{listResult}</span>
          <Link href="/admin/marketing/lists" style={{ fontSize: 12, color: "#185FA5", textDecoration: "underline", marginLeft: 4 }}>View in Lists →</Link>
          <button onClick={() => setListResult(null)} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      )}

      {actionResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E1F5EE", border: "0.5px solid #A7E0CE", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
          <i className="ti ti-circle-check" style={{ color: "#0F6E56" }} aria-hidden="true" />
          <span style={{ fontSize: 12.5, color: "#0F6E56", fontWeight: 500 }}>{actionResult}</span>
          <button onClick={() => setActionResult(null)} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      )}

      {canSelect && selectionCount > 0 && (
        <div style={{ background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "8px 13px", marginBottom: 12 }}>
          {/* Odoo selection bar: "N selected → Select all M ×" then one Actions menu. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#0C447C", fontWeight: 600, background: "#B5D4F4", borderRadius: 7, padding: "4px 10px" }}>{selectAllMatching ? `All ${matchingTotal.toLocaleString()} selected` : `${selected.size.toLocaleString()} selected`}</span>
            {!selectAllMatching && matchingTotal > selected.size && (
              <button onClick={() => setSelectAllMatching(true)} style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><i className="ti ti-arrow-right" aria-hidden="true" /> Select all {matchingTotal.toLocaleString()}</button>
            )}
            <button onClick={clearSelection} aria-label="Clear selection" style={{ fontSize: 14, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex" }}><i className="ti ti-x" aria-hidden="true" /></button>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setActionsOpen((v) => !v)} disabled={exportBusy} style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-settings" aria-hidden="true" /> {exportBusy ? "Exporting…" : "Actions"} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
              {actionsOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 220, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "6px 0" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>Selected contacts</div>
                  {([
                    canCreateList ? { key: "email", icon: "ti-mail", label: "Email", run: () => { closePanels(); setEmailOpen(true); } } : null,
                    canBulkAssign ? { key: "assign", icon: "ti-user-plus", label: "Lead assign", run: () => { closePanels(); setAssignOpen(true); setAssignMsg(null); } } : null,
                    canBulkEdit ? { key: "source", icon: "ti-tag", label: "Set lead source", run: () => { closePanels(); setSourceOpen(true); setSourceMsg(null); } } : null,
                    canCreateList ? { key: "list", icon: "ti-list-details", label: "Create list", run: () => { closePanels(); openListPanel(); } } : null,
                    canExport ? { key: "export", icon: "ti-download", label: "Export CSV", run: () => void exportCsv() } : null,
                  ] as Array<{ key: string; icon: string; label: string; run: () => void } | null>).filter((a): a is NonNullable<typeof a> => a !== null).map((a) => (
                    <button key={a.key} onClick={a.run} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                      <i className={`ti ${a.icon}`} style={{ fontSize: 15, color: "var(--muted-foreground)" }} aria-hidden="true" />{a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {canBulkEdit && sourceOpen && (
            <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Set lead source on {selectionCount.toLocaleString()} contact{selectionCount === 1 ? "" : "s"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select value={sourceVal} onChange={(e) => setSourceVal(e.target.value)} style={{ ...inp, minWidth: 180 }}>
                  {LEAD_SOURCE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={submitSetSource} disabled={sourceBusy} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: sourceBusy ? 0.55 : 1 }}>{sourceBusy ? "Applying…" : `Apply to ${selectionCount.toLocaleString()}`}</button>
                <button onClick={() => setSourceOpen(false)} style={{ fontSize: 12.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
                {sourceMsg && <span style={{ fontSize: 11.5, color: sourceBusy ? "#185FA5" : "#A32D2D" }}>{sourceMsg}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 8 }}>Replaces the current lead source. Kept on re-sync from Odoo.</div>
            </div>
          )}

          {canCreateList && listOpen && (
            <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                {(["new", "existing"] as const).map((m) => (
                  <button key={m} onClick={() => { setListMode(m); setListMsg(null); }} style={{ fontSize: 11.5, fontWeight: listMode === m ? 600 : 400, color: listMode === m ? "#fff" : "var(--muted-foreground)", background: listMode === m ? "#2E78F5" : "transparent", border: "none", padding: "5px 13px", cursor: "pointer" }}>{m === "new" ? "New list" : "Add to existing"}</button>
                ))}
              </div>
              {listMode === "new" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>List name</div>
                    <input value={listName} onChange={(e) => setListName(e.target.value)} autoFocus placeholder="e.g. Investor outreach — Sept" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Department</div>
                    <select value={listDept} onChange={(e) => setListDept(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                      {LIST_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Description (optional)</div>
                    <input value={listDesc} onChange={(e) => setListDesc(e.target.value)} placeholder="What this segment is for…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Add to list</div>
                  <select value={addToListId} onChange={(e) => setAddToListId(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                    <option value="">Choose a list…</option>
                    {existingLists.map((l) => <option key={l.id} value={l.id}>{l.name}{typeof l.contact_count === "number" ? ` (${l.contact_count})` : ""}</option>)}
                  </select>
                  {existingLists.length === 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 5 }}>No lists yet — switch to “New list”.</div>}
                </div>
              )}
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: "#185FA5", marginBottom: 10 }}>
                <i className="ti ti-info-circle" aria-hidden="true" /> Adds <b>{selectionCount.toLocaleString()}</b> selected contact{selectionCount === 1 ? "" : "s"} to the list. Contacts without an email are skipped.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={submitCreateList} disabled={listBusy || (listMode === "new" ? !listName.trim() : !addToListId)} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: listBusy || (listMode === "new" ? !listName.trim() : !addToListId) ? 0.55 : 1 }}>{listBusy ? "Working…" : listMode === "new" ? `Create list · ${selectionCount.toLocaleString()}` : `Add ${selectionCount.toLocaleString()} to list`}</button>
                <button onClick={() => setListOpen(false)} style={{ fontSize: 12.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
                {listMsg && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{listMsg}</span>}
              </div>
            </div>
          )}
          {assignOpen && (
            <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Add members to {selectionCount.toLocaleString()} contact{selectionCount === 1 ? "" : "s"}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 5 }}>Members (lead-assignable only)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, maxHeight: 132, overflowY: "auto" }}>
                {members.length === 0 && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No assignable members configured.</span>}
                {members.map((m) => {
                  const on = assignSel.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => setAssignSel((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])} style={{ fontSize: 11.5, fontWeight: on ? 600 : 400, color: on ? "#185FA5" : "var(--muted-foreground)", background: on ? "#E6F1FB" : "transparent", border: `0.5px solid ${on ? "#B5D4F4" : "var(--border)"}`, borderRadius: 16, padding: "4px 11px", cursor: "pointer" }}>{on ? <><i className="ti ti-check" aria-hidden="true" /> </> : "+ "}{m.name}</button>
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
          {canSelect && (
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

        {/* Active filters as removable chips (Odoo-style) — each × clears just that
            filter; "Clear all" resets them together. Reads the existing filter state. */}
        {(() => {
          const chips: { key: string; field: string; value: string; onRemove: () => void }[] = [];
          if (role) chips.push({ key: "role", field: "Type", value: role.charAt(0).toUpperCase() + role.slice(1), onRemove: () => setRole("") });
          for (const [fk, vals] of Object.entries(facetSel)) for (const v of vals) chips.push({ key: `f:${fk}:${v}`, field: (FACET_LABEL as Record<string, string>)[fk] ?? fk, value: v, onRemove: () => setFacetSel((s) => ({ ...s, [fk]: (s[fk] ?? []).filter((x) => x !== v) })) });
          for (const c of countries) chips.push({ key: `c:${c}`, field: "Country", value: c, onRemove: () => setCountries((cs) => cs.filter((x) => x !== c)) });
          for (const col of ["name", "company", "email", "phone"] as const) if (textFilters[col]) chips.push({ key: `t:${col}`, field: col.charAt(0).toUpperCase() + col.slice(1), value: textFilters[col], onRemove: () => setTextFilters((f) => ({ ...f, [col]: "" })) });
          if (q.trim()) chips.push({ key: "q", field: "Search", value: q, onRemove: () => setQ("") });
          if (chips.length === 0) return null;
          return (
            <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", margin: "0 0 12px" }}>
              <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>Filters</span>
              {chips.map((ch) => (
                <span key={ch.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#0C447C", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 16, padding: "3px 5px 3px 10px" }}>
                  <span style={{ color: "#185FA5" }}>{ch.field}:</span> {ch.value}
                  <button type="button" onClick={ch.onRemove} aria-label={`Remove ${ch.field} ${ch.value}`} style={{ width: 16, height: 16, border: "none", background: "#B5D4F4", color: "#0C447C", borderRadius: "50%", fontSize: 10, lineHeight: 1, cursor: "pointer" }}>×</button>
                </span>
              ))}
              <button type="button" onClick={() => { setQ(""); setTextFilters({ name: "", company: "", email: "", phone: "" }); setCountries([]); setRole(""); setFacetSel({}); }} style={{ fontSize: 11, color: "#A32D2D", background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer", marginLeft: 2 }}>Clear all</button>
            </div>
          );
        })()}

        {(groupBy === "profile"
          ? GROUP_DEFS.map((g) => ({ id: g.id as string, label: g.label as string, count: facets.counts[g.id] ?? groups[g.id]?.total ?? 0 }))
          : dynGroups
        ).map((g) => {
          const gs = groups[g.id];
          const count = g.count;
          const isOpen = !!expanded[g.id];
          return (
            <div key={g.id}>
              <button onClick={() => toggleGroup(g.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "#E6F1FB", border: "none", borderTop: "0.5px solid #e2e6ed", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0C447C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }}><polyline points="9 6 15 12 9 18" /></svg>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0C447C" }}>{g.label}</span>
                <span style={{ fontSize: 11, color: "#185FA5", background: "#B5D4F4", borderRadius: 10, padding: "1px 8px" }}>{count.toLocaleString()}</span>
              </button>
              {isOpen && (
                <div>
                  {(gs?.loading || !gs?.loaded) && (gs?.rows.length ?? 0) === 0 ? (
                    <p style={{ padding: "14px", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
                  ) : (gs?.rows.length ?? 0) === 0 ? (
                    <p style={{ padding: "14px", fontSize: 12.5, color: "var(--muted-foreground)" }}>No matching contacts in this group.</p>
                  ) : (
                    <>
                      {gs!.rows.map((c) => canSelect ? (
                        <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridColsSel, borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: selected.has(c.id) || selectAllMatching ? "#F5F9FF" : undefined }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <input type="checkbox" checked={selected.has(c.id) || selectAllMatching} onChange={() => toggleRow(c.id)} aria-label={`Select ${c.name}`} style={{ width: 14, height: 14, cursor: "pointer" }} />
                          </div>
                          <Link href={`${basePath}/${c.id}`} style={{ display: "grid", gridTemplateColumns: gridCols, gridColumn: "2 / -1", padding: "10px 14px", alignItems: "center", textDecoration: "none", color: "var(--foreground)" }}>
                            {visibleColumns.map((col) => <div key={col.key} style={{ minWidth: 0 }}>{renderCell(col.key, c)}</div>)}
                          </Link>
                        </div>
                      ) : (
                        <Link key={c.id} href={`${basePath}/${c.id}`} style={{ display: "grid", gridTemplateColumns: gridCols, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, textDecoration: "none", color: "var(--foreground)" }}>
                          {visibleColumns.map((col) => <div key={col.key} style={{ minWidth: 0 }}>{renderCell(col.key, c)}</div>)}
                        </Link>
                      ))}
                      {gs!.total > PAGE && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "8px 14px", background: "#F8FAFD", borderTop: "0.5px solid #eef1f5" }}>
                          <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                            {(gs!.page * PAGE + 1).toLocaleString()}–{Math.min(gs!.total, gs!.page * PAGE + gs!.rows.length).toLocaleString()} / {gs!.total.toLocaleString()}
                          </span>
                          <button onClick={() => goPage(g.id, -1)} disabled={gs!.loading || gs!.page === 0} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: gs!.page === 0 ? "#9aa4b2" : "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "4px 10px", cursor: gs!.page === 0 ? "not-allowed" : "pointer", opacity: gs!.page === 0 ? 0.5 : 1 }}>
                            <i className="ti ti-chevron-left" aria-hidden="true" /> Prev
                          </button>
                          <button onClick={() => goPage(g.id, 1)} disabled={gs!.loading || (gs!.page + 1) * PAGE >= gs!.total} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: (gs!.page + 1) * PAGE >= gs!.total ? "#9aa4b2" : "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "4px 10px", cursor: (gs!.page + 1) * PAGE >= gs!.total ? "not-allowed" : "pointer", opacity: (gs!.page + 1) * PAGE >= gs!.total ? 0.5 : 1 }}>
                            Next <i className="ti ti-chevron-right" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {groupBy !== "profile" && dynLoading && dynGroups.length === 0 && (
          <p style={{ padding: "16px", fontSize: 12.5, color: "var(--muted-foreground)", borderTop: "0.5px solid #e2e6ed" }}>Computing groups…</p>
        )}
        {groupBy !== "profile" && !dynLoading && dynGroups.length === 0 && (
          <p style={{ padding: "16px", fontSize: 12.5, color: "var(--muted-foreground)", borderTop: "0.5px solid #e2e6ed" }}>No contacts match the current filters.</p>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 2px 0" }}>
        {groupBy === "profile"
          ? "Grouped by membership type from Odoo (Entrepreneur shows as Founders). Click a column heading to sort, the filter icon to narrow by value, or Columns to choose what shows. Counts and filters run across all synced contacts."
          : `Grouped by ${groupByLabel.toLowerCase()}. Groups are collapsed — open one to load its contacts. Group by stacks on Filters, so you can narrow the set (e.g. Investors in FinTech) and then group. Counts run across all matching contacts.`}
      </p>
    </div>
  );
}

// Odoo-style unified search bar: facet pills + field type-ahead + a three-panel
// (Filters / Group By / Favorites) dropdown. Presentational — all state lives in the
// parent; this renders it and calls back.
type OdooSearchBarProps = {
  spec: FilterSpec; typed: string; setTyped: (v: string) => void; searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  addCondition: (c: Condition) => void; removeConditionAt: (i: number) => void; condLabel: (c: Condition) => string;
  toggleQuick: (c: Condition) => void; quickActive: (c: Condition) => boolean; firstOfMonth: () => string;
  groupBy: string; setGroupBy: (v: string) => void; groupByLabel: string;
  saved: SavedSearch[]; applySaved: (s: SavedSearch) => void; deleteSaved: (id: string) => void;
  openCustom: () => void; clearAll: () => void;
  facetOpts: Record<string, string[]>; toggleFacetValue: (field: string, v: string) => void; facetValueActive: (field: string, v: string) => boolean;
  save: { open: boolean; setOpen: (v: boolean) => void; name: string; setName: (v: string) => void; isDefault: boolean; setDefault: (v: boolean) => void; shared: boolean; setShared: (v: boolean) => void; submit: () => void };
};
function OdooSearchBar(p: OdooSearchBarProps) {
  const TEXT_FIELDS = [{ f: "name", l: "Name" }, { f: "company", l: "Company" }, { f: "email", l: "Email" }, { f: "phone", l: "Phone" }];
  // Odoo layout: Type first, then quick filters, then the questionnaire facets as
  // expandable rows with checkboxes, then Add custom filter.
  const TYPE_QUICK: { label: string; cond: Condition }[] = [
    { label: "Investors", cond: { field: "type", op: "in", value: ["investor"] } },
    { label: "Founders", cond: { field: "type", op: "in", value: ["founder"] } },
    { label: "Advisors", cond: { field: "type", op: "in", value: ["advisor"] } },
  ];
  const QUICK: { label: string; cond: Condition }[] = [
    { label: "Has email", cond: { field: "email", op: "set" } },
    { label: "Has phone", cond: { field: "phone", op: "set" } },
    { label: "Unassigned", cond: { field: "assignee", op: "not_set" } },
    { label: "Added this month", cond: { field: "createdAt", op: "after", value: p.firstOfMonth() } },
  ];
  const FACET_ROWS: { field: string; label: string; source: string }[] = [
    { field: "investorTypes", label: "Investor type", source: "investorTypes" },
    { field: "industries", label: "Industry", source: "industries" },
    { field: "leadSource", label: "Lead source", source: "leadSource" },
    { field: "operatingStages", label: "Operating stage", source: "operatingStages" },
    { field: "fundingStages", label: "Funding stage", source: "fundingStages" },
    { field: "capital", label: "Amount / type of capital", source: "capital" },
  ];
  const [openFacet, setOpenFacet] = useState<string | null>(null);
  const [facetQ, setFacetQ] = useState("");
  const groupOpts = GROUP_BY_OPTIONS.filter((o) => o.id === "profile" || o.section !== "profile");
  const item = { display: "block", width: "100%", textAlign: "left" as const, padding: "6px 12px 6px 26px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "var(--foreground)" };
  const mine = p.saved.filter((s) => s.mine);
  const shared = p.saved.filter((s) => !s.mine && s.isShared);
  const activeFacetCount = (field: string) => { const c = p.spec.conditions.find((c) => c.field === field && c.op === "in"); return Array.isArray(c?.value) ? c!.value.length : 0; };
  const favRow = (s: SavedSearch) => (
    <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
      <button onClick={() => p.applySaved(s)} style={{ ...item, flex: 1, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <i className="ti ti-star" style={{ color: "#7A5AA8", marginRight: 4 }} aria-hidden="true" />{s.name}
        {s.mine && s.isDefault ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · default</span> : null}
        {!s.mine ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · {s.ownerName ?? "Staff"}</span> : s.isShared ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · shared</span> : null}
      </button>
      {(s.canDelete ?? s.mine) && <button onClick={() => { if (window.confirm(`Delete saved search “${s.name}”?`)) p.deleteSaved(s.id); }} aria-label={`Delete ${s.name}`} title="Delete" style={{ border: "none", background: "none", color: "#A32D2D", cursor: "pointer", padding: "0 10px" }}><i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" /></button>}
    </div>
  );

  return (
    <div style={{ position: "relative", flex: "0 1 560px", minWidth: 280, marginLeft: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #cdd9ec", borderRadius: 9, padding: "5px 8px", background: "#fff", flexWrap: "wrap" }}>
        {p.spec.conditions.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", border: "0.5px solid #B5D4F4", background: "#E6F1FB", borderRadius: 6, overflow: "hidden", fontSize: 11.5 }}>
            <span style={{ padding: "3px 8px", color: "#0C447C" }}>{p.condLabel(c)}</span>
            <button onClick={() => p.removeConditionAt(i)} style={{ border: "none", background: "#B5D4F4", color: "#0C447C", padding: "3px 6px", cursor: "pointer" }}>×</button>
          </span>
        ))}
        {p.groupBy !== "profile" && (
          <span style={{ display: "inline-flex", alignItems: "center", border: "0.5px solid #E3C08A", background: "#FAEEDA", borderRadius: 6, overflow: "hidden", fontSize: 11.5 }}>
            <span style={{ padding: "3px 8px", color: "#633806" }}>▤ {p.groupByLabel}</span>
            <button onClick={() => p.setGroupBy("profile")} style={{ border: "none", background: "#E3C08A", color: "#633806", padding: "3px 6px", cursor: "pointer" }}>×</button>
          </span>
        )}
        <input
          value={p.typed}
          onChange={(e) => { p.setTyped(e.target.value); p.setSearchOpen(true); }}
          onFocus={() => p.setSearchOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && p.typed.trim()) p.addCondition({ field: "name", op: "contains", value: p.typed.trim() }); }}
          placeholder={p.spec.conditions.length ? "" : "Search…"}
          style={{ flex: 1, minWidth: 90, border: "none", outline: "none", fontSize: 13, padding: "4px 2px", background: "transparent" }}
        />
        <button onClick={() => p.setSearchOpen(!p.searchOpen)} style={{ border: "none", background: "none", color: "#2E78F5", cursor: "pointer", fontSize: 14 }}><i className="ti ti-chevron-down" aria-hidden="true" /></button>
      </div>

      {p.searchOpen && (
        <>
          <div onClick={() => p.setSearchOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />
          <div style={{ position: "absolute", top: "calc(100% + 5px)", right: 0, width: p.typed.trim() ? "100%" : 640, maxWidth: "calc(100vw - 48px)", zIndex: 30, background: "#fff", border: "0.5px solid #cbd5e1", borderRadius: 10, boxShadow: "0 14px 30px rgba(0,0,0,.14)", overflow: "hidden" }}>
            {p.typed.trim() ? (
              <div style={{ padding: "4px 0" }}>
                {TEXT_FIELDS.map(({ f, l }) => (
                  <button key={f} onClick={() => p.addCondition({ field: f, op: "contains", value: p.typed.trim() })} style={{ ...item, paddingLeft: 12 }}>
                    Search <b>{l}</b> for: <span style={{ color: "#185FA5" }}>{p.typed.trim()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", alignItems: "start" }}>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#185FA5" }}><i className="ti ti-filter" aria-hidden="true" /> FILTERS</div>
                  {TYPE_QUICK.map((qf) => {
                    const on = p.quickActive(qf.cond);
                    return <button key={qf.label} onClick={() => p.toggleQuick(qf.cond)} style={{ ...item, background: on ? "#EEF4FF" : "none", color: on ? "#185FA5" : "var(--foreground)" }}>{on ? "✓ " : ""}{qf.label}</button>;
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />
                  {QUICK.map((qf) => {
                    const on = p.quickActive(qf.cond);
                    return <button key={qf.label} onClick={() => p.toggleQuick(qf.cond)} style={{ ...item, background: on ? "#EEF4FF" : "none", color: on ? "#185FA5" : "var(--foreground)" }}>{on ? "✓ " : ""}{qf.label}</button>;
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />
                  {FACET_ROWS.map((f) => {
                    const isOpen = openFacet === f.field;
                    const n = activeFacetCount(f.field);
                    const all = p.facetOpts[f.source] ?? [];
                    const opts = all.filter((o) => o.toLowerCase().includes(facetQ.toLowerCase()));
                    return (
                      <div key={f.field}>
                        <button onClick={() => { setOpenFacet(isOpen ? null : f.field); setFacetQ(""); }} style={{ ...item, display: "flex", alignItems: "center", gap: 6, color: n ? "#185FA5" : "var(--foreground)" }}>
                          <span style={{ flex: 1 }}>{f.label}</span>
                          {n > 0 && <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "0 7px" }}>{n}</span>}
                          <i className={`ti ti-chevron-${isOpen ? "down" : "right"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                        </button>
                        {isOpen && (
                          <div style={{ padding: "2px 8px 8px 26px" }}>
                            {all.length > 8 && <input value={facetQ} onChange={(e) => setFacetQ(e.target.value)} placeholder="Search…" style={{ width: "100%", boxSizing: "border-box", fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--border)", marginBottom: 4 }} />}
                            <div style={{ maxHeight: 170, overflowY: "auto" }}>
                              {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "3px 0" }}>{all.length === 0 ? "No options loaded yet." : "No matches."}</div>}
                              {opts.map((o) => (
                                <label key={o} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0", fontSize: 12, cursor: "pointer" }}>
                                  <input type="checkbox" checked={p.facetValueActive(f.field, o)} onChange={() => p.toggleFacetValue(f.field, o)} style={{ width: 13, height: 13 }} />
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <button onClick={p.openCustom} style={{ ...item, color: "#2E78F5", fontWeight: 500, paddingLeft: 12 }}>＋ Add custom filter</button>
                </div>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#633806" }}><i className="ti ti-layout-list" aria-hidden="true" /> GROUP BY</div>
                  {groupOpts.map((o) => {
                    const on = p.groupBy === o.id;
                    return <button key={o.id} onClick={() => { p.setGroupBy(o.id); }} style={{ ...item, background: on ? "#FBF3E6" : "none", color: on ? "#633806" : "var(--foreground)" }}>{on ? "✓ " : ""}{o.id === "profile" ? "Type" : o.label}</button>;
                  })}
                </div>
                <div>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#7A5AA8" }}><i className="ti ti-star" aria-hidden="true" /> FAVORITES</div>
                  {mine.length === 0 && <div style={{ padding: "4px 12px 4px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>None yet — save one below.</div>}
                  {mine.map(favRow)}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <div style={{ padding: "8px 12px 3px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}><i className="ti ti-users" aria-hidden="true" /> SHARED FILTERS</div>
                  {shared.length === 0 && <div style={{ padding: "2px 12px 6px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing shared by the team yet.</div>}
                  {shared.map(favRow)}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <button onClick={() => p.save.setOpen(!p.save.open)} style={{ ...item, display: "flex", alignItems: "center", paddingLeft: 12, color: "var(--foreground)", fontWeight: 500 }}>
                    <span style={{ flex: 1 }}>Save current search</span>
                    <i className={`ti ti-chevron-${p.save.open ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  </button>
                  {p.save.open && (
                    <div style={{ margin: "2px 12px 8px", background: "var(--muted)", borderRadius: 8, padding: "8px 10px" }}>
                      <input value={p.save.name} onChange={(e) => p.save.setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") p.save.submit(); }} autoFocus placeholder="Name this search" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff", marginBottom: 7 }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={p.save.isDefault} onChange={(e) => p.save.setDefault(e.target.checked)} style={{ width: 13, height: 13 }} /> Default filter</label>
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={p.save.shared} onChange={(e) => p.save.setShared(e.target.checked)} style={{ width: 13, height: 13 }} /> Shared with team</label>
                      <button onClick={p.save.submit} disabled={!p.save.name.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#7A5AA8", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", opacity: p.save.name.trim() ? 1 : 0.5 }}>Save</button>
                    </div>
                  )}
                  {p.spec.conditions.length > 0 && <button onClick={() => { p.clearAll(); }} style={{ ...item, color: "#A32D2D", paddingLeft: 12 }}>Clear all filters</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
