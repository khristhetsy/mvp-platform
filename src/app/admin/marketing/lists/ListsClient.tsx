"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { MarketingList } from "@/lib/marketing/types";

type ListWithCount = MarketingList & { contact_count: number };

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
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
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
                <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 10px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C" }}>
                  {list.contact_count} contacts
                </span>
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
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
                {saving ? "Saving…" : editId ? "Save changes" : "Create list"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
