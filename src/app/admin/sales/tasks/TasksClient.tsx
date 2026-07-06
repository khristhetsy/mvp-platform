"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string; title: string; task_type: string; summary: string | null; due_date: string | null;
  status: "open" | "done" | "snoozed"; assignee_name: string | null; opportunity_id: string | null;
  contact_crm_id: string | null; contact_name: string | null;
};
type Scope = "my" | "all" | "overdue";

const TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  Call: { color: "#185FA5", bg: "#E6F1FB" }, Email: { color: "#4338CA", bg: "#EEF2FF" },
  Demo: { color: "#854F0B", bg: "#FAEEDA" }, "Follow-up": { color: "#3B6D11", bg: "#EAF3DE" }, Proposal: { color: "#993556", bg: "#FBEAF0" },
};
const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

function dueLabel(d: string | null): { text: string; color: string } {
  if (!d) return { text: "No date", color: "var(--muted-foreground)" };
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return { text: `${Math.round((Date.parse(today) - Date.parse(d)) / 86400000)}d overdue`, color: "#A32D2D" };
  if (d === today) return { text: "Today", color: "#854F0B" };
  return { text: d, color: "var(--muted-foreground)" };
}

export function TasksClient() {
  const [scope, setScope] = useState<Scope>("my");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", taskType: "Call", dueDate: "" });

  const load = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/tasks?scope=${s}`);
      const data = res.ok ? await res.json() : { tasks: [] };
      setTasks(data.tasks ?? []);
    } catch { setTasks([]); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / scope change
  useEffect(() => { void load(scope); }, [scope, load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await load(scope); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "DELETE" }); await load(scope); }
    finally { setBusy(false); }
  }
  async function add() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      setAdding(false); setDraft({ title: "", taskType: "Call", dueDate: "" });
      await load(scope);
    } finally { setBusy(false); }
  }

  const overdueCount = tasks.filter((t) => t.status === "open" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length;
  const scopeTab = (s: Scope, label: string, danger = false): React.CSSProperties => ({ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 5, padding: "5px 10px", background: scope === s ? "#2E78F5" : "transparent", color: scope === s ? "#fff" : danger ? "#A32D2D" : "var(--muted-foreground)" });

  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Tasks &amp; activities</span>
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: 7, padding: 2 }}>
            <button onClick={() => setScope("my")} style={scopeTab("my", "My")}>My</button>
            <button onClick={() => setScope("all")} style={scopeTab("all", "All")}>All</button>
            <button onClick={() => setScope("overdue")} style={scopeTab("overdue", "Overdue", true)}>Overdue{scope !== "overdue" && overdueCount ? ` ${overdueCount}` : ""}</button>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>+ New task</button>
        </div>

        {adding && (
          <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Task title" autoFocus style={inp} />
            <select value={draft.taskType} onChange={(e) => setDraft({ ...draft, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
            <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={inp} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={add} disabled={busy || !draft.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !draft.title.trim() ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setAdding(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        )}

        {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : tasks.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No tasks. Create one, or add tasks from a contact or opportunity.</p>
          : tasks.map((t) => {
              const due = dueLabel(t.due_date);
              const tc = TYPE_COLOR[t.task_type] ?? { color: "#5F5E5A", bg: "#F1EFE8" };
              const done = t.status === "done";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: done ? "var(--muted-foreground)" : due.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-foreground)" : "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {t.contact_name ? (t.contact_crm_id ? <Link href={`/admin/sales/contacts/${t.contact_crm_id}`} style={{ color: "#185FA5", textDecoration: "none" }}>{t.contact_name}</Link> : t.contact_name) : t.opportunity_id ? <Link href={`/admin/sales/opportunities/${t.opportunity_id}`} style={{ color: "#185FA5", textDecoration: "none" }}>opportunity</Link> : "—"}
                      {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, color: tc.color, background: tc.bg, borderRadius: 8, padding: "2px 8px" }}>{t.task_type}</span>
                  <span style={{ fontSize: 11, color: due.color, width: 78, textAlign: "right" }}>{done ? "Done" : due.text}</span>
                  {!done && <button onClick={() => patch(t.id, { status: "done" })} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}>✓ Done</button>}
                  {!done && <button onClick={() => patch(t.id, { status: "snoozed", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })} disabled={busy} style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Snooze</button>}
                  <button onClick={() => del(t.id)} disabled={busy} style={{ fontSize: 10.5, color: "#A32D2D", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
      </div>
    </div>
  );
}
