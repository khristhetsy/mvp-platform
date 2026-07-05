"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Eye, Mail, Pencil, Trash2, ArrowUp, ArrowDown, Columns3, Check, X } from "lucide-react";
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

const AVATAR_COLORS = [
  { bg: "#EEEDFE", color: "#1A6CE4" }, { bg: "#E1F5EE", color: "#085041" }, { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#FAEEDA", color: "#633806" }, { bg: "#FBEAF0", color: "#72243E" },
];
const EVENT_COLOR: Record<string, { bg: string; color: string }> = {
  sent: { bg: "#F1EFE8", color: "#5F5E5A" }, delivered: { bg: "#E1F5EE", color: "#0F6E56" },
  opened: { bg: "#E6F1FB", color: "#185FA5" }, clicked: { bg: "#EEEDFE", color: "#1A6CE4" },
  bounced: { bg: "#FAEEDA", color: "#854F0B" }, unsubscribed: { bg: "#FCEBEB", color: "#A32D2D" }, spam_complaint: { bg: "#FCEBEB", color: "#A32D2D" },
};
function avatarColor(email: string) { return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(c: MarketingContact) {
  const fn = (c.first_name?.[0] ?? "").toUpperCase();
  const ln = (c.last_name?.[0] ?? "").toUpperCase();
  return fn + ln || c.email[0].toUpperCase();
}
const ICON_BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" };

type ActivityEvent = { id: string; event_type: string; occurred_at: string; campaign_name: string | null; sequence_name: string | null; metadata: Record<string, unknown> };
type ActivityData = { contact: MarketingContact & { created_at: string }; events: ActivityEvent[]; unsubscribed: { email: string; reason: string | null; unsubscribed_at: string } | null };

export function ContactsTable({ contacts, lists, total, page, limit, currentSearch, currentListId, currentTag, currentSort, currentDir }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [listId, setListId] = useState(currentListId);
  const [tagFilter, setTagFilter] = useState(currentTag);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editTagsId, setEditTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [activityId, setActivityId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [activityContact, setActivityContact] = useState<MarketingContact | null>(null);
  const [editContact, setEditContact] = useState<MarketingContact | null>(null);
  const [cols, setCols] = useState({ company: true, tags: true, source: true });
  const [showCols, setShowCols] = useState(false);

  const totalPages = Math.ceil(total / limit);
  const allTags = [...new Set(contacts.flatMap((c) => c.tags ?? []))].sort();

  function navTo(over: Partial<{ search: string; list: string; tag: string; sort: string; dir: string }>) {
    const s = over.search ?? search, l = over.list ?? listId, t = over.tag ?? tagFilter;
    const so = over.sort ?? currentSort, di = over.dir ?? currentDir;
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (l) params.set("list_id", l);
    if (t) params.set("tag", t);
    if (so && so !== "created_at") params.set("sort", so);
    if (di && di !== "desc") params.set("dir", di);
    startTransition(() => router.push(`/admin/marketing/contacts?${params.toString()}`));
  }

  function toggleSort(col: "name" | "company") {
    if (currentSort === col) navTo({ sort: col, dir: currentDir === "asc" ? "desc" : "asc" });
    else navTo({ sort: col, dir: "asc" });
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
    const res = await fetch("/api/marketing/import-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, list_id: listId || null }) });
    const data = await res.json();
    setImportResult({ ok: true, msg: `Imported ${data.imported} contacts. Skipped ${data.skipped} invalid rows.` });
    setImporting(false); router.refresh();
  }

  function getContactTags(c: MarketingContact): string[] { return localTags[c.id] !== undefined ? localTags[c.id] : (c.tags ?? []); }
  async function saveTag(contactId: string, tags: string[]) {
    setLocalTags((prev) => ({ ...prev, [contactId]: tags }));
    await fetch(`/api/marketing/contacts/${contactId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) });
  }
  function addTag(contactId: string, tag: string) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    const current = getContactTags(contacts.find((c) => c.id === contactId)!);
    if (current.includes(clean)) return;
    void saveTag(contactId, [...current, clean]); setTagInput("");
  }
  function removeTag(contact: MarketingContact, tag: string) { void saveTag(contact.id, getContactTags(contact).filter((t) => t !== tag)); }

  async function openActivity(contact: MarketingContact) {
    setActivityId(contact.id); setActivityContact(contact); setLoadingActivity(true); setActivity(null);
    const res = await fetch(`/api/marketing/contacts/${contact.id}/activity`);
    if (res.ok) setActivity(await res.json());
    setLoadingActivity(false);
  }

  // Dynamic grid template from visible columns.
  const template = ["36px", "2fr", cols.company ? "1.3fr" : null, cols.tags ? "1.2fr" : null, cols.source ? "90px" : null, "128px"].filter(Boolean).join(" ");
  const sortArrow = (col: "name" | "company") => currentSort === col ? (currentDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null;

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
      {showAdd && <AddContactForm lists={lists} onDone={() => { setShowAdd(false); router.refresh(); }} />}

      {/* Filters + sort + columns */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <input type="text" placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && navTo({ search })} style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--foreground)" }} />
        </div>
        <select value={listId} onChange={(e) => { setListId(e.target.value); navTo({ list: e.target.value }); }} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <a href="/admin/marketing/lists" title="Create a new contact list" style={{ fontSize: 12, fontWeight: 700, padding: "7px 11px", borderRadius: 8, border: "0.5px solid #93C5FD", background: "#EFF6FF", color: "#1A6CE4", textDecoration: "none", whiteSpace: "nowrap" }}>＋ Create list</a>
        <select value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); navTo({ tag: e.target.value }); }} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={`${currentSort}:${currentDir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); navTo({ sort: s, dir: d }); }} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }} title="Sort">
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
              {(["company", "tags", "source"] as const).map((k) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "5px 6px", cursor: "pointer", textTransform: "capitalize" }}>
                  <input type="checkbox" checked={cols[k]} onChange={() => setCols((c) => ({ ...c, [k]: !c[k] }))} /> {k}
                </label>
              ))}
            </div>
          )}
        </div>
        {(search || listId || tagFilter) && (
          <button onClick={() => { setSearch(""); setListId(""); setTagFilter(""); navTo({ search: "", list: "", tag: "" }); }} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "none", background: "var(--muted)", color: "var(--muted-foreground)", cursor: "pointer" }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: template, padding: "8px 16px", background: "var(--muted)", borderBottom: "0.5px solid #e2e6ed", alignItems: "center" }}>
          <div />
          <button onClick={() => toggleSort("name")} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Contact {sortArrow("name")}</button>
          {cols.company && <button onClick={() => toggleSort("company")} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Company {sortArrow("company")}</button>}
          {cols.tags && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Tags</div>}
          {cols.source && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Source</div>}
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textAlign: "right" }}>Actions</div>
        </div>

        {contacts.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>No contacts match your filters.</div>
        ) : (
          contacts.map((c) => {
            const av = avatarColor(c.email);
            const tags = getContactTags(c);
            const isEditingTags = editTagsId === c.id;
            const displayName = [c.first_name, c.last_name].filter(Boolean).join(" ");
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: template, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
                <button onClick={() => openActivity(c)} title="Open contact" style={{ width: 28, height: 28, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, border: "none", cursor: "pointer", padding: 0 }}>{initials(c)}</button>
                <div onClick={() => openActivity(c)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openActivity(c); } }} title="Open contact" style={{ minWidth: 0, cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1A6CE4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName || c.email}</div>
                  {displayName && <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
                </div>
                {cols.company && <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company ?? "—"}</div>}
                {cols.tags && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                    {tags.map((tag) => (
                      <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#1A6CE4", fontWeight: 500 }}>
                        {tag}{isEditingTags && <button onClick={() => removeTag(c, tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1A6CE4", padding: 0, lineHeight: 1, fontSize: 11 }}>×</button>}
                      </span>
                    ))}
                    {isEditingTags ? (
                      <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(c.id, tagInput); } if (e.key === "Escape") setEditTagsId(null); }} placeholder="add tag…" style={{ fontSize: 10, width: 70, border: "1px solid #2E78F5", borderRadius: 8, padding: "2px 5px", outline: "none", background: "var(--input)" }} />
                    ) : (
                      <button onClick={() => { setEditTagsId(c.id); setTagInput(""); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>+ tag</button>
                    )}
                  </div>
                )}
                {cols.source && <div>{c.source ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1EFE8", color: "#5F5E5A", fontWeight: 500 }}>{c.source}</span> : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}</div>}
                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                  <button onClick={() => openActivity(c)} style={ICON_BTN} title="View activity"><Eye size={14} /></button>
                  <a href={`mailto:${c.email}`} style={{ ...ICON_BTN, textDecoration: "none" }} title="Email"><Mail size={14} /></a>
                  <button onClick={() => setEditContact(c)} style={ICON_BTN} title="Edit"><Pencil size={14} /></button>
                  <DeleteContactButton contactId={c.id} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{total.toLocaleString()} contacts · page {page} of {Math.max(totalPages, 1)}</span>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            {page > 1 && <a href={`/admin/marketing/contacts?page=${page - 1}&search=${search}&list_id=${listId}&tag=${tagFilter}&sort=${currentSort}&dir=${currentDir}`} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", textDecoration: "none" }}>← Prev</a>}
            {page < totalPages && <a href={`/admin/marketing/contacts?page=${page + 1}&search=${search}&list_id=${listId}&tag=${tagFilter}&sort=${currentSort}&dir=${currentDir}`} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", textDecoration: "none" }}>Next →</a>}
          </div>
        )}
      </div>

      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} onSaved={() => { setEditContact(null); router.refresh(); }} />}

      {/* Activity drawer — portalled to body so it isn't trapped by scroll/overflow ancestors */}
      {activityId && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={() => setActivityId(null)}>
          <div style={{ width: activityExpanded ? "min(1000px, 94vw)" : 480, maxWidth: "100vw", height: "100%", background: "#fff", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 24px rgb(12 35 64 / 0.14)", overflowY: "auto", padding: 24, transition: "width 0.15s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Contact activity</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => setActivityExpanded((v) => !v)} title={activityExpanded ? "Collapse" : "Expand"} style={{ background: "none", border: "0.5px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "var(--muted-foreground)", padding: "4px 8px" }}>{activityExpanded ? "⤢ Collapse" : "⤢ Expand"}</button>
                <button onClick={() => setActivityId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted-foreground)" }}>×</button>
              </div>
            </div>
            {loadingActivity && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>}
            {activity && (
              <>
                <div style={{ marginBottom: 20, padding: "12px 14px", background: "var(--muted)", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{[activity.contact.first_name, activity.contact.last_name].filter(Boolean).join(" ") || activity.contact.email}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{activity.contact.email}</div>
                  {activity.contact.company && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{activity.contact.company}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{(activity.contact.tags ?? []).map((t) => <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#1A6CE4" }}>{t}</span>)}</div>
                  {activity.unsubscribed && <div style={{ marginTop: 8, fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "#FCEBEB", color: "#A32D2D" }}>Unsubscribed · {new Date(activity.unsubscribed.unsubscribed_at).toLocaleDateString()}</div>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 10 }}>{activity.events.length} events</div>
                {/* actions */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <a href={`mailto:${activity.contact.email}`} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", borderRadius: 8, padding: "9px 12px", textDecoration: "none" }}>Send email</a>
                  <button onClick={() => { if (activityContact) { setEditContact(activityContact); setActivityId(null); } }} disabled={!activityContact} style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 8, padding: "9px 15px", cursor: activityContact ? "pointer" : "default", opacity: activityContact ? 1 : 0.5 }}>Edit</button>
                </div>
                {activity.events.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No email events yet.</div> : activity.events.map((ev) => {
                  const ec = EVENT_COLOR[ev.event_type] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
                  return (
                    <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, paddingBottom: 10, borderBottom: "0.5px solid var(--border)" }}>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: ec.bg, color: ec.color, fontWeight: 500, whiteSpace: "nowrap", marginTop: 1 }}>{ev.event_type}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--foreground)" }}>{ev.campaign_name ?? ev.sequence_name ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(ev.occurred_at).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function DeleteContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  async function handleDelete() { await fetch(`/api/marketing/contacts?id=${contactId}`, { method: "DELETE" }); router.refresh(); }
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
