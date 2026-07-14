"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Eye, Mail, Pencil, Trash2, ArrowUp, ArrowDown, Columns3, Check, X, ChevronDown, ChevronRight, ListPlus, Tag as TagIcon } from "lucide-react";
import type { MarketingContact, MarketingList } from "@/lib/marketing/types";

interface Props {
  contacts: MarketingContact[];
  lists: MarketingList[];
  total: number;
  page: number;
  limit: number;
  currentSearch: string;
  currentListId: string;
  currentTag: string;
  currentSort: "name" | "company" | "created_at";
  currentDir: "asc" | "desc";
}

const PAGE = 50;
const AVATAR_COLORS = [
  { bg: "#EEEDFE", color: "#1A6CE4" }, { bg: "#E1F5EE", color: "#085041" }, { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#FAEEDA", color: "#633806" }, { bg: "#FBEAF0", color: "#72243E" },
];
function avatarColor(email: string) { return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(c: MarketingContact) {
  const fn = (c.first_name?.[0] ?? "").toUpperCase();
  const ln = (c.last_name?.[0] ?? "").toUpperCase();
  return fn + ln || c.email[0].toUpperCase();
}
const ICON_BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" };

type GroupState = { rows: MarketingContact[]; total: number; loading: boolean };

export function ContactsTable({ contacts, lists: initialLists, total, currentSearch, currentTag, currentSort, currentDir }: Props) {
  const router = useRouter();
  const [lists, setLists] = useState<MarketingList[]>(initialLists);
  const [groupBy, setGroupBy] = useState<"none" | "list">("none");

  const [search, setSearch] = useState(currentSearch);
  const [tagFilter, setTagFilter] = useState(currentTag);
  const [sort, setSort] = useState<"name" | "company" | "created_at">(currentSort);
  const [dir, setDir] = useState<"asc" | "desc">(currentDir);
  const [cols, setCols] = useState({ company: true, type: false, membership: false, phone: false, email: false, lead_assign: false, tags: true, source: true });
  const [showCols, setShowCols] = useState(false);

  // None-mode data (seeded from server props).
  const [noneState, setNoneState] = useState<GroupState>({ rows: contacts, total, loading: false });
  // List-mode data, keyed by list id.
  const [listData, setListData] = useState<Record<string, GroupState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialLists[0] ? [initialLists[0].id] : []));
  const expandedRef = useRef(expanded);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  // Selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<null | "list" | "tag">(null);
  const [bulkListId, setBulkListId] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sub-features preserved from the original table.
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editTagsId, setEditTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [editContact, setEditContact] = useState<MarketingContact | null>(null);

  function openProfile(id: string) { router.push(`/admin/marketing/contacts/${id}`); }

  const base = useCallback((extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (tagFilter) p.set("tag", tagFilter);
    p.set("sort", sort); p.set("dir", dir);
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return p.toString();
  }, [search, tagFilter, sort, dir]);

  const fetchGrid = useCallback(async (extra: Record<string, string | number>): Promise<GroupState> => {
    try {
      const res = await fetch(`/api/marketing/contacts/grid?${base(extra)}`);
      if (!res.ok) return { rows: [], total: 0, loading: false };
      const d = await res.json();
      return { rows: d.contacts ?? [], total: d.total ?? 0, loading: false };
    } catch { return { rows: [], total: 0, loading: false }; }
  }, [base]);

  const loadNone = useCallback(async (reset: boolean) => {
    setNoneState((s) => ({ ...s, loading: true }));
    const offset = reset ? 0 : noneState.rows.length;
    const g = await fetchGrid({ offset, limit: PAGE });
    setNoneState((s) => reset ? g : { rows: [...s.rows, ...g.rows], total: g.total, loading: false });
  }, [fetchGrid, noneState.rows.length]);

  const loadList = useCallback(async (listId: string, reset: boolean) => {
    setListData((d) => ({ ...d, [listId]: { rows: d[listId]?.rows ?? [], total: d[listId]?.total ?? 0, loading: true } }));
    const offset = reset ? 0 : (listData[listId]?.rows.length ?? 0);
    const g = await fetchGrid({ list_id: listId, offset, limit: PAGE });
    setListData((d) => ({ ...d, [listId]: reset ? g : { rows: [...(d[listId]?.rows ?? []), ...g.rows], total: g.total, loading: false } }));
  }, [fetchGrid, listData]);

  // Reload the current view whenever filters/sort/grouping change (debounced).
  const queryKey = `${groupBy}|${search}|${tagFilter}|${sort}|${dir}`;
  useEffect(() => {
    const t = setTimeout(() => {
      if (groupBy === "none") { void loadNone(true); }
      else { setListData({}); for (const id of expandedRef.current) void loadList(id, true); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on queryKey; loaders read fresh state
  }, [queryKey]);

  async function refreshLists() {
    try { const res = await fetch("/api/marketing/lists"); if (res.ok) setLists(await res.json()); } catch { /* ignore */ }
  }
  function reloadView() {
    if (groupBy === "none") void loadNone(true);
    else for (const id of expandedRef.current) void loadList(id, true);
  }

  function toggleList(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else { next.add(id); if (!listData[id]) void loadList(id, true); }
      return next;
    });
  }

  function toggleSort(col: "name" | "company") {
    if (sort === col) setDir((d) => d === "asc" ? "desc" : "asc");
    else { setSort(col); setDir("asc"); }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
    const res = await fetch("/api/marketing/import-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, list_id: null }) });
    const data = await res.json();
    setImportResult({ ok: true, msg: `Imported ${data.imported} contacts. Skipped ${data.skipped} invalid rows.` });
    setImporting(false); reloadView(); void refreshLists();
  }

  function getContactTags(c: MarketingContact): string[] { return localTags[c.id] !== undefined ? localTags[c.id] : (c.tags ?? []); }
  async function saveTag(contactId: string, tags: string[]) {
    setLocalTags((prev) => ({ ...prev, [contactId]: tags }));
    await fetch(`/api/marketing/contacts/${contactId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) });
  }
  function addTag(contact: MarketingContact, tag: string) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    const current = getContactTags(contact);
    if (current.includes(clean)) return;
    void saveTag(contact.id, [...current, clean]); setTagInput("");
  }
  function removeTag(contact: MarketingContact, tag: string) { void saveTag(contact.id, getContactTags(contact).filter((t) => t !== tag)); }

  // Selection helpers.
  function toggleSelect(id: string) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function selectMany(ids: string[], on: boolean) { setSelected((s) => { const n = new Set(s); ids.forEach((id) => on ? n.add(id) : n.delete(id)); return n; }); }
  function clearSelection() { setSelected(new Set()); setBulkMode(null); setConfirmDelete(false); }

  async function runBulk(bodyExtra: Record<string, unknown>) {
    setBulkBusy(true);
    try {
      const res = await fetch("/api/marketing/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected], ...bodyExtra }) });
      if (res.ok) { clearSelection(); reloadView(); void refreshLists(); }
    } finally { setBulkBusy(false); }
  }

  const template = ["30px", "30px", "2fr", cols.company ? "1.3fr" : null, cols.type ? "84px" : null, cols.membership ? "1fr" : null, cols.phone ? "1fr" : null, cols.email ? "1.4fr" : null, cols.lead_assign ? "1.1fr" : null, cols.tags ? "1.2fr" : null, cols.source ? "90px" : null, "128px"].filter(Boolean).join(" ");
  const sortArrow = (col: "name" | "company") => sort === col ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null;

  function renderRow(c: MarketingContact) {
    const av = avatarColor(c.email);
    const tags = getContactTags(c);
    const isEditingTags = editTagsId === c.id;
    const displayName = [c.first_name, c.last_name].filter(Boolean).join(" ");
    const isSel = selected.has(c.id);
    return (
      <div key={c.id} style={{ display: "grid", gridTemplateColumns: template, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", alignItems: "center", background: isSel ? "#F5F9FF" : undefined }}>
        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id)} aria-label="Select contact" style={{ width: 14, height: 14 }} />
        <button onClick={() => openProfile(c.id)} title="Open contact" style={{ width: 28, height: 28, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, border: "none", cursor: "pointer", padding: 0 }}>{initials(c)}</button>
        <div onClick={() => openProfile(c.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProfile(c.id); } }} title="Open contact" style={{ minWidth: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1A6CE4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName || c.email}</div>
          {displayName && <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
        </div>
        {cols.company && <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company ?? "—"}</div>}
        {cols.type && <div>{c.type ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10, background: "#EEEDFE", color: "#4338CA", textTransform: "capitalize" }}>{c.type}</span> : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}</div>}
        {cols.membership && <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.membership ?? "—"}</div>}
        {cols.phone && <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: c.phone ? "var(--foreground)" : "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.phone || "—"}</div>}
        {cols.email && <div style={{ fontSize: 12, color: "#1A6CE4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
        {cols.lead_assign && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", overflow: "hidden" }}>{c.assignees && c.assignees.length ? (<>{c.assignees.slice(0, 2).map((n) => <span key={n} style={{ fontSize: 10, background: "#E6F1FB", color: "#185FA5", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>{n}</span>)}{c.assignees.length > 2 && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>+{c.assignees.length - 2}</span>}</>) : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}</div>}
        {cols.tags && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {tags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#1A6CE4", fontWeight: 500 }}>
                {tag}{isEditingTags && <button onClick={() => removeTag(c, tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1A6CE4", padding: 0, lineHeight: 1, fontSize: 11 }}>×</button>}
              </span>
            ))}
            {isEditingTags ? (
              <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(c, tagInput); } if (e.key === "Escape") setEditTagsId(null); }} placeholder="add tag…" style={{ fontSize: 10, width: 70, border: "1px solid #2E78F5", borderRadius: 8, padding: "2px 5px", outline: "none", background: "var(--input)" }} />
            ) : (
              <button onClick={() => { setEditTagsId(c.id); setTagInput(""); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>+ tag</button>
            )}
          </div>
        )}
        {cols.source && <div>{c.source ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1EFE8", color: "#5F5E5A", fontWeight: 500 }}>{c.source}</span> : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}</div>}
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
          <button onClick={() => openProfile(c.id)} style={ICON_BTN} title="Open contact"><Eye size={14} /></button>
          <a href={`mailto:${c.email}`} style={{ ...ICON_BTN, textDecoration: "none" }} title="Email"><Mail size={14} /></a>
          <button onClick={() => setEditContact(c)} style={ICON_BTN} title="Edit"><Pencil size={14} /></button>
          <DeleteContactButton contactId={c.id} onDeleted={() => { reloadView(); void refreshLists(); }} />
        </div>
      </div>
    );
  }

  function renderRows(gs: GroupState | undefined) {
    if (!gs || (gs.loading && gs.rows.length === 0)) return <div style={{ padding: 20, fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</div>;
    if (gs.rows.length === 0) return <div style={{ padding: 20, fontSize: 12.5, color: "var(--muted-foreground)" }}>No contacts here.</div>;
    return (
      <>
        {gs.rows.map(renderRow)}
        {gs.rows.length < gs.total && (
          <button onClick={() => (groupBy === "none" ? loadNone(false) : null)} disabled={gs.loading} style={{ width: "100%", padding: 9, fontSize: 11.5, color: "#185FA5", background: "transparent", border: "none", borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}>
            {gs.loading ? "Loading…" : `Load ${Math.min(PAGE, gs.total - gs.rows.length)} more of ${gs.total.toLocaleString()}`}
          </button>
        )}
      </>
    );
  }

  const allTagsInView = [...new Set(noneState.rows.flatMap((c) => c.tags ?? []))].sort();

  return (
    <div style={{ padding: 24, maxWidth: 1140 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Contacts</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{total.toLocaleString()} total</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer" }}>↑ Import CSV</button>
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>+ Add contact</button>
        </div>
      </div>

      {showImport && (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "16px 18px", marginBottom: 14, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Import contacts from CSV</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>Columns: <code style={{ fontSize: 11, background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>email, first_name, last_name, company, title, source</code></div>
          <input type="file" accept=".csv" onChange={handleCsvImport} disabled={importing} style={{ fontSize: 12 }} />
          {importing && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--muted-foreground)" }}>Importing…</span>}
          {importResult && <div style={{ marginTop: 8, fontSize: 12, color: "#0F6E56" }}>{importResult.msg}</div>}
        </div>
      )}
      {showAdd && <AddContactForm lists={lists} onDone={() => { setShowAdd(false); reloadView(); void refreshLists(); }} />}

      {/* Filters + group + sort + columns */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <input type="text" placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--foreground)" }} />
        </div>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "none" | "list")} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }} title="Group by">
          <option value="none">No grouping</option>
          <option value="list">Group by list</option>
        </select>
        <a href="/admin/marketing/lists" title="Create a new contact list" style={{ fontSize: 12, fontWeight: 700, padding: "7px 11px", borderRadius: 8, border: "0.5px solid #93C5FD", background: "#EFF6FF", color: "#1A6CE4", textDecoration: "none", whiteSpace: "nowrap" }}>＋ Create list</a>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
          <option value="">All tags</option>
          {allTagsInView.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); setSort(s as "name" | "company" | "created_at"); setDir(d as "asc" | "desc"); }} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }} title="Sort">
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="company:asc">Company A–Z</option>
          <option value="company:desc">Company Z–A</option>
        </select>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowCols((v) => !v)} style={{ ...ICON_BTN, width: "auto", padding: "0 10px", gap: 5, height: 32 }} title="Columns"><Columns3 size={14} /> <span style={{ fontSize: 12 }}>Columns</span></button>
          {showCols && (
            <div style={{ position: "absolute", right: 0, top: 36, zIndex: 20, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 8, padding: 8, boxShadow: "0 8px 24px rgb(12 35 64 / 0.12)", minWidth: 150 }}>
              {([
                ["company", "Company"], ["type", "Type"], ["membership", "Membership"],
                ["phone", "Phone"], ["email", "Email"], ["lead_assign", "Lead assign"],
                ["tags", "Tags"], ["source", "Source"],
              ] as const).map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "5px 6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={cols[k]} onChange={() => setCols((c) => ({ ...c, [k]: !c[k] }))} /> {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "8px 12px", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#0C447C", fontWeight: 500 }}>{selected.size} selected</span>
          <button onClick={clearSelection} style={{ fontSize: 11.5, color: "#185FA5", background: "transparent", border: "none", cursor: "pointer" }}>Clear</button>
          <div style={{ flex: 1 }} />
          {bulkMode === "list" ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={bulkListId} onChange={(e) => setBulkListId(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff" }}>
                <option value="">Choose list…</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button disabled={!bulkListId || bulkBusy} onClick={() => runBulk({ action: "add_to_list", list_id: bulkListId })} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", opacity: !bulkListId || bulkBusy ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setBulkMode(null)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : bulkMode === "tag" ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && bulkTag.trim() && runBulk({ action: "tag", tag: bulkTag })} autoFocus placeholder="tag name…" style={{ fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff" }} />
              <button disabled={!bulkTag.trim() || bulkBusy} onClick={() => runBulk({ action: "tag", tag: bulkTag })} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", opacity: !bulkTag.trim() || bulkBusy ? 0.5 : 1 }}>Apply</button>
              <button onClick={() => setBulkMode(null)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : confirmDelete ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11.5, color: "#A32D2D" }}>Delete {selected.size} contacts?</span>
              <button disabled={bulkBusy} onClick={() => runBulk({ action: "delete" })} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer" }}>Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : (
            <>
              <button onClick={() => { setBulkMode("list"); setBulkListId(""); }} style={{ fontSize: 11.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><ListPlus size={13} /> Add to list</button>
              <button onClick={() => { setBulkMode("tag"); setBulkTag(""); }} style={{ fontSize: 11.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><TagIcon size={13} /> Tag</button>
              <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 11.5, background: "#fff", border: "0.5px solid #F09595", color: "#A32D2D", borderRadius: 7, padding: "6px 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={13} /> Delete</button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: template, padding: "8px 16px", background: "var(--muted)", borderBottom: "0.5px solid #e2e6ed", alignItems: "center" }}>
          <div>
            <input type="checkbox" aria-label="Select all in view" checked={noneState.rows.length > 0 && groupBy === "none" && noneState.rows.every((c) => selected.has(c.id))} onChange={(e) => { if (groupBy === "none") selectMany(noneState.rows.map((c) => c.id), e.target.checked); }} style={{ width: 14, height: 14 }} />
          </div>
          <div />
          <button onClick={() => toggleSort("name")} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Contact {sortArrow("name")}</button>
          {cols.company && <button onClick={() => toggleSort("company")} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Company {sortArrow("company")}</button>}
          {cols.type && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Type</div>}
          {cols.membership && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Membership</div>}
          {cols.phone && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Phone</div>}
          {cols.email && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Email</div>}
          {cols.lead_assign && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Lead assign</div>}
          {cols.tags && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Tags</div>}
          {cols.source && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Source</div>}
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textAlign: "right" }}>Actions</div>
        </div>

        {groupBy === "none" ? renderRows(noneState) : (
          lists.length === 0 ? <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>No lists yet. Create a list to group contacts.</div> :
          lists.map((l) => {
            const gs = listData[l.id];
            const isOpen = expanded.has(l.id);
            return (
              <div key={l.id}>
                <button onClick={() => toggleList(l.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "#E6F1FB", border: "none", borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}>
                  {isOpen ? <ChevronDown size={15} color="#0C447C" /> : <ChevronRight size={15} color="#0C447C" />}
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0C447C" }}>{l.name}</span>
                  <span style={{ fontSize: 11, color: "#185FA5", background: "#B5D4F4", borderRadius: 10, padding: "1px 8px" }}>{(gs?.total ?? l.contact_count ?? 0).toLocaleString()}</span>
                </button>
                {isOpen && renderRows(gs)}
              </div>
            );
          })
        )}
      </div>

      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} onSaved={() => { setEditContact(null); reloadView(); }} />}
    </div>
  );
}

function DeleteContactButton({ contactId, onDeleted }: { contactId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  async function handleDelete() { await fetch(`/api/marketing/contacts?id=${contactId}`, { method: "DELETE" }); onDeleted(); }
  if (confirming) {
    return <button onClick={handleDelete} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }} title="Confirm delete"><Check size={14} /></button>;
  }
  return <button onClick={() => setConfirming(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }} title="Delete"><Trash2 size={14} /></button>;
}

function EditContactModal({ contact, onClose, onSaved }: { contact: MarketingContact; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch(`/api/marketing/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); setSaving(false); }
    else onSaved();
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 440, background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 12px 40px rgb(12 35 64 / 0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Edit contact</div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>{contact.email}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { name: "first_name", label: "First name", val: contact.first_name ?? "" },
            { name: "last_name", label: "Last name", val: contact.last_name ?? "" },
            { name: "company", label: "Company", val: contact.company ?? "" },
            { name: "title", label: "Title", val: contact.title ?? "" },
          ].map((f) => (
            <div key={f.name}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input name={f.name} defaultValue={f.val} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
            </div>
          ))}
        </div>
        {error && <div style={{ color: "#A32D2D", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function AddContactForm({ lists, onDone }: { lists: MarketingList[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/marketing/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); } else onDone();
    setSaving(false);
  }
  return (
    <form onSubmit={handleSubmit} style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "16px 18px", marginBottom: 14, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Add contact</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { name: "email", label: "Email *", type: "email", required: true }, { name: "first_name", label: "First name", type: "text" },
          { name: "last_name", label: "Last name", type: "text" }, { name: "company", label: "Company", type: "text" },
          { name: "title", label: "Title", type: "text" }, { name: "source", label: "Source", type: "text" },
        ].map((f) => (
          <div key={f.name}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
            <input name={f.name} type={f.type} required={f.required} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
        ))}
      </div>
      {lists.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Add to list (optional)</label>
          <select name="list_id" style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}>
            <option value="">— none —</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      {error && <div style={{ color: "#A32D2D", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>{saving ? "Saving…" : "Save contact"}</button>
        <button type="button" onClick={onDone} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button>
      </div>
    </form>
  );
}
