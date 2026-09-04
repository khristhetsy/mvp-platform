"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { MarketingContact, MarketingList } from "@/lib/marketing/types";
import { DEPARTMENTS, UNASSIGNED, DEPT_META, departmentOf, groupByDepartment } from "@/lib/marketing/department-grouping";

type ListWithCount = MarketingList & { contact_count: number };
type ListMember = { contact_id: string; marketing_contacts: Pick<MarketingContact, "id" | "email" | "first_name" | "last_name" | "company"> | null };

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

export function ListsClient({ lists: initialLists }: { lists: ListWithCount[] }) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", department: "" });
  const [saving, setSaving] = useState(false);
  const [manageList, setManageList] = useState<ListWithCount | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Department grouping + archive (mirrors Templates/Campaigns).
  const [groupByDept, setGroupByDept] = useState(true);
  const [openDepts, setOpenDepts] = useState<Record<string, boolean>>({}); // collapsed by default
  const [sortKey, setSortKey] = useState<"name" | "created">("name");
  const [showArchived, setShowArchived] = useState(false);
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const deptOf = (l: ListWithCount) => departmentOf(l.department);

  async function moveToDepartment(l: ListWithCount, dept: string) {
    setMoveOpen(null);
    const value = dept === UNASSIGNED ? null : dept;
    setLists((prev) => prev.map((x) => (x.id === l.id ? { ...x, department: value } : x))); // optimistic
    try {
      await fetch(`/api/marketing/lists/${l.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ department: value }),
      });
    } catch (err) { console.error("Failed to move list department:", err); }
  }

  async function toggleArchive(l: ListWithCount) {
    const next = !l.archived;
    setBusyId(l.id);
    setLists((prev) => prev.map((x) => (x.id === l.id ? { ...x, archived: next } : x))); // optimistic
    try {
      await fetch(`/api/marketing/lists/${l.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: next }),
      });
    } catch (err) { console.error("Failed to archive list:", err); }
    finally { setBusyId(null); }
  }

  function setListCount(id: string, count: number) {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, contact_count: count } : l)));
    setManageList((m) => (m && m.id === id ? { ...m, contact_count: count } : m));
  }

  function openCreate() { setForm({ name: "", description: "", department: "" }); setShowCreate(true); }
  function openEdit(list: ListWithCount) { setForm({ name: list.name, description: list.description ?? "", department: list.department ?? "" }); setEditId(list.id); }
  function closeModal() { setShowCreate(false); setEditId(null); }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(`/api/marketing/lists/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const updated = await res.json();
        setLists((prev) => prev.map((l) => l.id === editId ? { ...l, ...updated } : l));
      } else {
        const res = await fetch("/api/marketing/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const created = await res.json();
        setLists((prev) => [{ ...created, contact_count: 0 }, ...prev]);
      }
      closeModal();
      router.refresh();
    } catch (err) {
      console.error("Failed to save list:", err);
    } finally { setSaving(false); }
  }

  // Delete with a 30-second undo window: the row is marked deleted immediately, but the
  // actual hard DELETE only fires after 30s (cancellable via Undo). No soft-delete flag.
  async function del(id: string) {
    if (!(await confirmDialog({ message: "Delete this list? Contacts are not deleted.", danger: true, confirmLabel: "Delete" }))) return;
    setPendingIds((s) => new Set(s).add(id));
    timers.current[id] = setTimeout(() => { void finalizeDelete(id); }, 30000);
  }
  async function finalizeDelete(id: string) {
    delete timers.current[id];
    try {
      await fetch(`/api/marketing/lists/${id}`, { method: "DELETE" });
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Failed to delete list:", err);
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }
  function undoDelete(id: string) {
    const t = timers.current[id];
    if (t) clearTimeout(t);
    delete timers.current[id];
    setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }
  useEffect(() => { const t = timers.current; return () => { for (const k of Object.keys(t)) clearTimeout(t[k]); }; }, []);

  const listRow = (list: ListWithCount, isLast: boolean) => pendingIds.has(list.id) ? (
    <div key={list.id} style={{ padding: "14px 18px", borderBottom: isLast ? "none" : "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", borderStyle: "dashed", background: "#fafbfe", opacity: 0.85 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", textDecoration: "line-through" }}>{list.name}</div>
        <div style={{ fontSize: 11.5, color: "#1a7f4e", marginTop: 3 }}><i className="ti ti-check" aria-hidden="true" /> Deleted — will not reappear. Undo within 30 seconds.</div>
      </div>
      <button onClick={() => undoDelete(list.id)}
        style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "0.5px solid #cdd9ec", background: "#fff", color: "#0A1A40", cursor: "pointer" }}>
        Undo
      </button>
    </div>
  ) : (
    <div key={list.id} style={{ padding: "14px 18px", borderBottom: isLast ? "none" : "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, opacity: list.archived ? 0.6 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 7 }}>
          {list.name}
          {list.archived && <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "#5F5E5A", background: "#F1EFE8", borderRadius: 8, padding: "1px 7px" }}>Archived</span>}
        </div>
        {list.description && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{list.description}</div>
        )}
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
          Created {new Date(list.created_at).toLocaleDateString()}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setManageList(list)} title="Manage contacts in this list"
          style={{ fontSize: 11, fontWeight: 500, padding: "3px 11px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
          {list.contact_count} contacts
        </button>
        <button onClick={() => setManageList(list)}
          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer", whiteSpace: "nowrap" }}>
          Add / manage
        </button>
        <button onClick={() => openEdit(list)}
          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
          Edit
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMoveOpen(moveOpen === list.id ? null : list.id)} title="File this list under a department"
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <i className={`ti ${DEPT_META[deptOf(list)].icon}`} style={{ color: DEPT_META[deptOf(list)].color }} aria-hidden="true" /> Move <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
          </button>
          {moveOpen === list.id && (
            <>
              <div onClick={() => setMoveOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 41, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 8, boxShadow: "0 6px 18px rgb(12 35 64 / 0.14)", minWidth: 190, overflow: "hidden", padding: "4px 0" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", padding: "6px 12px 4px" }}>Move to department</div>
                {[...DEPARTMENTS, UNASSIGNED].map((d) => {
                  const cur = deptOf(list) === d;
                  return (
                    <button key={d} onClick={() => void moveToDepartment(list, d)}
                      style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 12, background: cur ? "#EEF0F4" : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--foreground)" }}>
                      <i className={`ti ${DEPT_META[d].icon}`} style={{ color: DEPT_META[d].color, fontSize: 14 }} aria-hidden="true" /> {d}
                      {cur && <i className="ti ti-check" style={{ marginLeft: "auto", color: "#185FA5" }} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button onClick={() => void toggleArchive(list)} disabled={busyId === list.id}
          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
          {list.archived ? "Unarchive" : "Archive"}
        </button>
        <button onClick={() => del(list.id)}
          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
          Delete
        </button>
      </div>
    </div>
  );

  const visible = [...lists]
    .filter((l) => showArchived || !l.archived)
    .sort((a, b) => sortKey === "created" ? (b.created_at ?? "").localeCompare(a.created_at ?? "") : a.name.localeCompare(b.name));
  const archivedCount = lists.filter((l) => l.archived).length;
  const grouped = groupByDepartment(visible, deptOf);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Contact lists</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{lists.length} total · group contacts into lists to target campaigns</div>
        </div>
        <button onClick={openCreate}
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
          + New list
        </button>
      </div>

      {/* Toolbar: group toggle + sort + show archived */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setGroupByDept((v) => !v)} title="Group lists under collapsible department headers"
          style={{ fontSize: 11.5, borderRadius: 6, padding: "5px 11px", border: groupByDept ? "0.5px solid #B5D4F4" : "0.5px solid #cdd9ec", background: groupByDept ? "#E6F1FB" : "transparent", color: groupByDept ? "#185FA5" : "var(--muted-foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-layout-list" aria-hidden="true" /> {groupByDept ? "Group: Department" : "Group: Off"}
        </button>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as "name" | "created")}
          style={{ fontSize: 12, padding: "5px 9px", borderRadius: 6, border: "0.5px solid #cdd9ec", background: "#fff", color: "var(--foreground)" }}>
          <option value="name">Name A–Z</option>
          <option value="created">Newest</option>
        </select>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)}
            style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>

      {/* List rows */}
      {lists.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No lists yet — create one to start grouping contacts.
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          All lists are archived. Use “Show archived” above to see them.
        </div>
      ) : !groupByDept ? (
        <div style={{ ...card, overflow: "hidden" }}>
          {visible.map((list, i) => listRow(list, i === visible.length - 1))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {grouped.map(({ dept, items }) => {
            const open = !!openDepts[dept];
            return (
              <div key={dept} style={{ border: "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--muted)" }}>
                <button onClick={() => setOpenDepts((o) => ({ ...o, [dept]: !o[dept] }))}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: "#EEF0F4", border: "none", borderBottom: open ? "0.5px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C447C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}><polyline points="9 6 15 12 9 18" /></svg>
                  <i className={`ti ${DEPT_META[dept].icon}`} style={{ color: DEPT_META[dept].color, fontSize: 15 }} aria-hidden="true" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--foreground)" }}>{dept}</span>
                  <span style={{ fontSize: 11, color: DEPT_META[dept].color, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, padding: "1px 8px" }}>{items.length}</span>
                </button>
                {open && <div style={{ background: "#fff" }}>{items.map((list, i) => listRow(list, i === items.length - 1))}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || editId) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e6ed", borderRadius: 14, padding: 24, width: 420, maxWidth: "90vw" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>
              {editId ? "Edit list" : "New list"}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>List name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Family offices, Cold prospects" autoFocus
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Who is in this list?"
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Department</label>
              <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", boxSizing: "border-box" }}>
                <option value="">— Unassigned —</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={closeModal}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer", opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
                {saving ? "Saving…" : editId ? "Save changes" : "Create list"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageList && (
        <ManageContactsDrawer
          list={manageList}
          onClose={() => setManageList(null)}
          onCountChange={(n) => setListCount(manageList.id, n)}
        />
      )}
    </div>
  );
}

function ManageContactsDrawer({ list, onClose, onCountChange }: { list: ListWithCount; onClose: () => void; onCountChange: (n: number) => void }) {
  const [members, setMembers] = useState<ListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketingContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onCountRef = useRef(onCountChange);
  useEffect(() => { onCountRef.current = onCountChange; }, [onCountChange]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/marketing/lists/${list.id}/contacts`);
    const data = res.ok ? await res.json() : [];
    const arr: ListMember[] = Array.isArray(data) ? data : [];
    setMembers(arr);
    setLoading(false);
    onCountRef.current(arr.length);
  }, [list.id]);

  /* eslint-disable react-hooks/set-state-in-effect -- load list members when drawer opens */
  useEffect(() => { void loadMembers(); }, [loadMembers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- debounced contact search */
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/marketing/contacts?search=${encodeURIComponent(query.trim())}`);
      const data = res.ok ? await res.json() : [];
      setResults(Array.isArray(data) ? data : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const memberIds = new Set(members.map((m) => m.contact_id));
  const name = (c: { first_name?: string | null; last_name?: string | null; email: string }) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;

  async function add(contactId: string) {
    setBusyId(contactId);
    await fetch(`/api/marketing/lists/${list.id}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_ids: [contactId] }) });
    await loadMembers();
    setBusyId(null);
  }
  async function remove(contactId: string) {
    setBusyId(contactId);
    await fetch(`/api/marketing/lists/${list.id}/contacts?contact_id=${contactId}`, { method: "DELETE" });
    await loadMembers();
    setBusyId(null);
  }

  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "0.5px solid var(--border)", gap: 8 };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 470, maxWidth: "92vw", height: "100%", background: "#fff", borderLeft: "1px solid #e2e6ed", overflowY: "auto", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{list.name}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted-foreground)" }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>{members.length} contacts in this list</div>

        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Add contacts</div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, company…" autoFocus
          style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", boxSizing: "border-box", marginBottom: 8, background: "var(--background)", color: "var(--foreground)" }} />
        {searching && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>Searching…</div>}
        {results.length > 0 && (
          <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 8, marginBottom: 18, overflow: "hidden" }}>
            {results.map((c) => (
              <div key={c.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name(c)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}{c.company ? ` · ${c.company}` : ""}</div>
                </div>
                {memberIds.has(c.id) ? (
                  <span style={{ fontSize: 11, color: "#0F6E56", whiteSpace: "nowrap" }}><i className="ti ti-check" aria-hidden="true" /> Added</span>
                ) : (
                  <button onClick={() => add(c.id)} disabled={busyId === c.id}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer", whiteSpace: "nowrap" }}>{busyId === c.id ? "…" : "Add"}</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>In this list</div>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No contacts yet. Search above to add some.</div>
        ) : (
          <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 8, overflow: "hidden" }}>
            {members.map((m) => (
              <div key={m.contact_id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.marketing_contacts ? name(m.marketing_contacts) : m.contact_id}</div>
                  {m.marketing_contacts && <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.marketing_contacts.email}</div>}
                </div>
                <button onClick={() => remove(m.contact_id)} disabled={busyId === m.contact_id}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{busyId === m.contact_id ? "…" : "Remove"}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
