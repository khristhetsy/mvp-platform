"use client";

import { useState } from "react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

type Suppression = { email: string; reason: string | null; unsubscribed_at: string };

const REASON_LABELS: Record<string, string> = {
  user_request: "User request",
  bounce: "Hard bounce",
  spam_complaint: "Spam complaint",
  manual_admin: "Admin",
};

const S = {
  page: { padding: 24 } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 } as React.CSSProperties,
  btn: (v: "primary" | "ghost" | "danger") => ({
    padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: "none", cursor: "pointer",
    background: v === "primary" ? "#534AB7" : v === "danger" ? "#FCEBEB" : "var(--muted)",
    color: v === "danger" ? "#A32D2D" : v === "ghost" ? "var(--foreground)" : "#fff",
  } as React.CSSProperties),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: { textAlign: "left" as const, padding: "8px 12px", fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" },
  td: { padding: "10px 12px", borderBottom: "0.5px solid var(--border)", color: "var(--foreground)", verticalAlign: "middle" as const },
  badge: (reason: string | null) => {
    const r = reason ?? "manual_admin";
    if (r === "bounce") return { background: "#FAEEDA", color: "#854F0B" };
    if (r === "spam_complaint") return { background: "#FCEBEB", color: "#A32D2D" };
    return { background: "#F1EFE8", color: "#5F5E5A" };
  },
  input: { padding: "7px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--input)", color: "var(--foreground)", outline: "none" } as React.CSSProperties,
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 },
  modalBox: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 24, width: 380, maxWidth: "90vw" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4, display: "block" } as React.CSSProperties,
  empty: { textAlign: "center" as const, color: "var(--muted-foreground)", fontSize: 13, padding: "48px 0" },
};

export function SuppressionsClient({ suppressions: initial }: { suppressions: Suppression[] }) {
  const [rows, setRows] = useState(initial);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const filtered = rows.filter((r) =>
    !search || r.email.toLowerCase().includes(search.toLowerCase())
  );

  async function add() {
    if (!addEmail.includes("@")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail }),
      });
      if (res.ok) {
        setRows((prev) => [{ email: addEmail, reason: "manual_admin", unsubscribed_at: new Date().toISOString() }, ...prev]);
        setAddEmail("");
        setShowAdd(false);
      }
    } catch (err) {
      console.error("Failed to add suppression:", err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(email: string) {
    if (!(await confirmDialog({ message: `Remove ${email} from suppression list? They will be eligible to receive emails again.`, danger: true, confirmLabel: "Remove" }))) return;
    setRemoving(email);
    try {
      await fetch(`/api/marketing/suppressions?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.email !== email));
    } catch (err) {
      console.error("Failed to remove suppression:", err);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Suppression list</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
            {rows.length} suppressed — emails on this list will not receive any campaigns or sequences
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={S.input} placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={S.empty}>{search ? "No matching emails." : "No suppressed emails."}</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Email</th>
              <th style={S.th}>Reason</th>
              <th style={S.th}>Suppressed at</th>
              <th style={S.th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.email}>
                <td style={S.td}>{row.email}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge(row.reason), padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
                    {REASON_LABELS[row.reason ?? "manual_admin"] ?? row.reason}
                  </span>
                </td>
                <td style={{ ...S.td, color: "var(--muted-foreground)" }}>
                  {new Date(row.unsubscribed_at).toLocaleString()}
                </td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button
                    style={{ ...S.btn("danger"), fontSize: 11, padding: "4px 10px", opacity: removing === row.email ? 0.5 : 1 }}
                    onClick={() => remove(row.email)}
                    disabled={removing === row.email}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Add to suppression list</h3>
            <label style={S.label}>Email address</label>
            <input
              style={{ ...S.input, width: "100%", marginBottom: 20, boxSizing: "border-box" }}
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="contact@example.com"
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                style={{ ...S.btn("primary"), opacity: saving || !addEmail.includes("@") ? 0.6 : 1 }}
                onClick={add}
                disabled={saving || !addEmail.includes("@")}
              >
                {saving ? "Adding…" : "Add to suppression list"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
