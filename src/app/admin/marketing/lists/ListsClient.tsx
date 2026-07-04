"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { MarketingContact, MarketingList } from "@/lib/marketing/types";

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
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [manageList, setManageList] = useState<ListWithCount | null>(null);

  function setListCount(id: string, count: number) {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, contact_count: count } : l)));
    setManageList((m) => (m && m.id === id ? { ...m, contact_count: count } : m));
  }

  function openCreate() { setForm({ name: "", description: "" }); setShowCreate(true); }
  function openEdit(list: ListWithCount) { setForm({ name: list.name, description: list.description ?? "" }); setEditId(list.id); }
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

  async function del(id: string) {
    if (!(await confirmDialog({ message: "Delete this list? Contacts are not deleted.", danger: true, confirmLabel: "Delete" }))) return;
    setDeleting(id);
    try {
      await fetch(`/api/marketing/lists/${id}`, { method: "DELETE" });
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Failed to delete list:", err);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Contact lists</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Group contacts into lists to target campaigns</div>
        </div>
        <button onClick={openCreate}
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
          + New list
        </button>
      </div>

      {/* List rows inside white card */}
      {lists.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No lists yet — create one to start grouping contacts.
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          {lists.map((list, i) => (
            <div key={list.id} style={{ padding: "14px 18px", borderBottom: i < lists.length - 1 ? "0.5px solid var(--border)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{list.name}</div>
                {list.description && (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{list.description}</div>
                )}
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                  Created {new Date(list.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setManageList(list)} title="Manage contacts in this list"
                  style={{ fontSize: 11, fontWeight: 500, padding: "3px 11px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C", border: "none", cursor: "pointer" }}>
                  {list.contact_count} contacts
                </button>
                <button onClick={() => setManageList(list)}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                  Add / manage
                </button>
                <button onClick={() => openEdit(list)}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                  Edit
                </button>
                <button onClick={() => del(list.id)} disabled={deleting === list.id}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer", opacity: deleting === list.id ? 0.5 : 1 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
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

  return (
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
                  <span style={{ fontSize: 11, color: "#0F6E56", whiteSpace: "nowrap" }}>✓ Added</span>
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
    </div>
  );
}
