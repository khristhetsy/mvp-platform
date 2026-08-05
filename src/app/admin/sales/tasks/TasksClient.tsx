"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Task = {
  id: string; title: string; task_type: string; summary: string | null; due_date: string | null;
  status: "open" | "done" | "snoozed"; assignee_id: string | null; assignee_name: string | null; opportunity_id: string | null;
  contact_crm_id: string | null; contact_name: string | null;
  opportunity_status: string | null; opportunity_name: string | null;
};

/** Add N business days (skip weekends) → YYYY-MM-DD. */
function addBusinessDays(n: number): string {
  const d = new Date();
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}
type Scope = "my" | "all" | "overdue";
type Staff = { id: string; name: string };
const TASK_TYPES = ["Call", "Email", "Demo", "Follow-up", "Proposal"];

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

export function TasksClient({ staff }: { staff: Staff[] }) {
  const [scope, setScope] = useState<Scope>("my");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<{ task: Task; title: string; taskType: string; dueDate: string; assigneeId: string } | null>(null);
  const viewAs = useSearchParams().get("viewAs");
  const viewQ = viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : "";

  const load = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/tasks?scope=${s}${viewQ}`);
      const data = res.ok ? await res.json() : { tasks: [] };
      setTasks(data.tasks ?? []);
    } catch { setTasks([]); }
    setLoading(false);
  }, [viewQ]);

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
      await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, taskType: draft.taskType, dueDate: draft.dueDate || null, assigneeId: draft.assigneeId || null }) });
      setAdding(false); setDraft({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
      await load(scope);
    } finally { setBusy(false); }
  }
  async function markDone(t: Task) {
    await patch(t.id, { status: "done" });
    // Prompt for the next task only while the linked opportunity is still open.
    if (t.opportunity_id && t.opportunity_status === "open") {
      setNextStep({ task: t, title: t.title, taskType: t.task_type, dueDate: addBusinessDays(3), assigneeId: t.assignee_id ?? "" });
    }
  }
  async function createNextStep() {
    if (!nextStep) return;
    const ns = nextStep;
    setBusy(true);
    try {
      await fetch("/api/sales/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ns.title, taskType: ns.taskType, dueDate: ns.dueDate || null, assigneeId: ns.assigneeId || null,
          opportunityId: ns.task.opportunity_id, contactCrmId: ns.task.contact_crm_id, contactName: ns.task.contact_name,
        }),
      });
      setNextStep(null);
      await load(scope);
    } finally { setBusy(false); }
  }
  function startEdit(t: Task) { setEditId(t.id); setEdit({ title: t.title, taskType: t.task_type, dueDate: t.due_date ?? "", assigneeId: t.assignee_id ?? "" }); }
  async function saveEdit(id: string) {
    if (!edit.title.trim()) return;
    await patch(id, { title: edit.title, taskType: edit.taskType, dueDate: edit.dueDate || null, assigneeId: edit.assigneeId || null });
    setEditId(null);
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
          <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 8, alignItems: "center" }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Task title" autoFocus style={inp} />
            <select value={draft.taskType} onChange={(e) => setDraft({ ...draft, taskType: e.target.value })} style={inp}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={inp} />
            <select value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={add} disabled={busy || !draft.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !draft.title.trim() ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setAdding(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        )}

        {nextStep && (
          <div style={{ padding: 14, borderTop: "0.5px solid #eef1f5", background: "#E6F1FB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "#0F6E56" }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Task completed — this deal is still open</span>
              {nextStep.task.opportunity_name && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#854F0B", background: "#FAEEDA", borderRadius: 999, padding: "2px 9px" }}>{nextStep.task.opportunity_name}</span>}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 10px" }}>Keep the opportunity moving — schedule the next step. You&rsquo;ll be prompted after each task until the deal is marked Won or Lost.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 130px", gap: 8 }}>
              <input value={nextStep.title} onChange={(e) => setNextStep({ ...nextStep, title: e.target.value })} style={inp} />
              <select value={nextStep.taskType} onChange={(e) => setNextStep({ ...nextStep, taskType: e.target.value })} style={inp}>{TASK_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
              <input type="date" value={nextStep.dueDate} onChange={(e) => setNextStep({ ...nextStep, dueDate: e.target.value })} style={inp} />
              <select value={nextStep.assigneeId} onChange={(e) => setNextStep({ ...nextStep, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
              <button onClick={createNextStep} disabled={busy || !nextStep.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !nextStep.title.trim() ? 0.5 : 1 }}>+ Create next task</button>
              <button onClick={() => setNextStep(null)} style={{ fontSize: 12, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>Not now</button>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>No prompt once the deal is Won or Lost</span>
            </div>
          </div>
        )}

        <style>{`
          .tHead,.tRow{display:grid;grid-template-columns:minmax(0,1fr) 92px 100px 128px 82px minmax(150px,auto);gap:10px;align-items:center;}
          .tActions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}
          @media(max-width:760px){
            .tHead{display:none;}
            .tRow{grid-template-columns:1fr 1fr;row-gap:6px;}
            .tRow .cTask{grid-column:1 / -1;}
            .tActions{grid-column:1 / -1;justify-content:flex-start;}
            .cLbl[data-label]::before{content:attr(data-label)": ";color:var(--muted-foreground);font-size:10px;text-transform:uppercase;letter-spacing:.04em;}
          }
        `}</style>

        {!loading && tasks.length > 0 && (
          <div className="tHead" style={{ padding: "8px 14px", borderTop: "0.5px solid #eef1f5", background: "#F7F9FC", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            <span>Task</span><span>Type</span><span>Due date</span><span>Assignee</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
          </div>
        )}

        {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : tasks.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No tasks. Create one, or add tasks from a contact or opportunity.</p>
          : tasks.map((t) => {
              const due = dueLabel(t.due_date);
              const tc = TYPE_COLOR[t.task_type] ?? { color: "#5F5E5A", bg: "#F1EFE8" };
              const done = t.status === "done";
              if (confirmId === t.id) {
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderTop: "0.5px solid #eef1f5", background: "#FCEBEB" }}>
                    <span style={{ fontSize: 12.5, color: "#A32D2D" }}>⚠ Delete &ldquo;{t.title}&rdquo;{t.contact_name ? ` for ${t.contact_name}` : ""}? This can&rsquo;t be undone.</span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={async () => { await del(t.id); setConfirmId(null); }} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>Delete</button>
                      <button onClick={() => setConfirmId(null)} style={{ fontSize: 12, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                );
              }
              if (editId === t.id) {
                return (
                  <div key={t.id} style={{ padding: "12px 14px", borderTop: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 8, alignItems: "center" }}>
                    <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} style={inp} />
                    <select value={edit.taskType} onChange={(e) => setEdit({ ...edit, taskType: e.target.value })} style={inp}>{TASK_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
                    <input type="date" value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} style={inp} />
                    <select value={edit.assigneeId} onChange={(e) => setEdit({ ...edit, assigneeId: e.target.value })} style={inp}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveEdit(t.id)} disabled={busy || !edit.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={t.id} className="tRow" style={{ padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                  <div className="cTask" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: done ? "var(--muted-foreground)" : due.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-foreground)" : "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        {t.contact_name ? (t.contact_crm_id ? <Link href={`/admin/sales/contacts/${t.contact_crm_id}`} style={{ color: "#185FA5", textDecoration: "none" }}>{t.contact_name}</Link> : t.contact_name) : t.opportunity_id ? <Link href={`/admin/sales/opportunities/${t.opportunity_id}`} style={{ color: "#185FA5", textDecoration: "none" }}>opportunity</Link> : "—"}
                      </div>
                    </div>
                  </div>
                  <span className="cLbl" data-label="Type" style={{ fontSize: 10.5, color: tc.color, background: tc.bg, borderRadius: 8, padding: "2px 8px", justifySelf: "start" }}>{t.task_type}</span>
                  <span className="cLbl" data-label="Due" style={{ fontSize: 11, color: due.color }}>{due.text}</span>
                  <span className="cLbl" data-label="Assignee" style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.assignee_name ?? "—"}</span>
                  <span className="cLbl" data-label="Status" style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", justifySelf: "start", color: done ? "#0F6E56" : "#854F0B", background: done ? "#E1F5EE" : "#FAEEDA" }}>{done ? "Done" : "Open"}</span>
                  <div className="tActions">
                    <button onClick={() => startEdit(t)} disabled={busy} style={{ fontSize: 10.5, color: "#185FA5", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                    {!done && <button onClick={() => markDone(t)} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}>✓ Done</button>}
                    {!done && <button onClick={() => patch(t.id, { status: "snoozed", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })} disabled={busy} style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Snooze</button>}
                    <button onClick={() => setConfirmId(t.id)} disabled={busy} style={{ fontSize: 10.5, color: "#A32D2D", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
