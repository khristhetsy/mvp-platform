"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingList } from "@/lib/marketing/types";

type ListWithCount = MarketingList & { contact_count: number };

const S = {
  page: { padding: 24, maxWidth: 900 } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 } as React.CSSProperties,
  btn: (variant: "primary" | "ghost" | "danger") => ({
    padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: "none", cursor: "pointer",
    background: variant === "primary" ? "#534AB7" : variant === "danger" ? "#A32D2D" : "var(--muted)",
    color: variant === "ghost" ? "var(--foreground)" : "#fff",
  } as React.CSSProperties),
  card: { background: "var(--card)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } as React.CSSProperties,
  input: { width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)", background: "var(--input)", color: "var(--foreground)", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4, display: "block" } as React.CSSProperties,
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 },
  modalBox: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 24, width: 400, maxWidth: "90vw" } as React.CSSProperties,
  badge: { padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "#E6F1FB", color: "#185FA5" } as React.CSSProperties,
  empty: { textAlign: "center" as const, color: "var(--muted-foreground)", fontSize: 13, padding: "48px 0" },
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
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this list? Contacts are not deleted.")) return;
    setDeleting(id);
    await fetch(`/api/marketing/lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
    setDeleting(null);
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Contact lists</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
            Group contacts into lists to target campaigns
          </p>
        </div>
        <button style={S.btn("primary")} onClick={openCreate}>+ New list</button>
      </div>

      {lists.length === 0 ? (
        <div style={S.empty}>No lists yet — create one to start grouping contacts.</div>
      ) : (
        lists.map((list) => (
          <div key={list.id} style={S.card}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{list.name}</div>
              {list.description && (
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{list.description}</div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                Created {new Date(list.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={S.badge}>{list.contact_count} contacts</span>
              <button style={S.btn("ghost")} onClick={() => openEdit(list)}>Edit</button>
              <button
                style={{ ...S.btn("ghost"), color: "#A32D2D", opacity: deleting === list.id ? 0.5 : 1 }}
                onClick={() => del(list.id)}
                disabled={deleting === list.id}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {(showCreate || editId) && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>
              {editId ? "Edit list" : "New list"}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>List name *</label>
              <input
                style={S.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Family offices, Cold prospects"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Description (optional)</label>
              <input
                style={S.input}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Who is in this list?"
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={closeModal}>Cancel</button>
              <button style={{ ...S.btn("primary"), opacity: saving || !form.name.trim() ? 0.6 : 1 }} onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Saving…" : editId ? "Save changes" : "Create list"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
