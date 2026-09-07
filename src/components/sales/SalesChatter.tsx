"use client";

/**
 * Odoo-style chatter for the Sales Hub — Send message / Log note / Activities + a
 * unified timeline. Self-contained: it fetches its own activity + tasks and reuses
 * existing endpoints (Gmail send, /api/sales/tasks, /api/sales/chatter), so it can be
 * dropped onto both the opportunity and contact detail without touching their state.
 */

import { useCallback, useEffect, useState } from "react";

type Activity = { id: string; kind: string; summary: string; actor_name: string | null; created_at: string };
type Task = { id: string; title: string; task_type: string; due_date: string | null; status: string; assignee_name: string | null };
type Staff = { id: string; name: string };
type Tab = "message" | "note" | "activity";

const KIND_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  email: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  email_draft: { icon: "ti-mail", color: "#854F0B", bg: "#FAEEDA" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  stage_changed: { icon: "ti-arrow-right", color: "#5F5E5A", bg: "#F1EFE8" },
  won: { icon: "ti-trophy", color: "#0F6E56", bg: "#E1F5EE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  converted: { icon: "ti-refresh", color: "#185FA5", bg: "#E6F1FB" },
};
function icon(kind: string) { return KIND_ICON[kind] ?? { icon: "ti-point", color: "#5F5E5A", bg: "#F1EFE8" }; }
function ago(iso: string) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "no due date", overdue: false };
  const d = new Date(iso).getTime(); const days = Math.round((d - Date.now()) / 86400000);
  if (days < 0) return { text: `${-days}d overdue`, overdue: true };
  if (days === 0) return { text: "due today", overdue: false };
  return { text: `due in ${days}d`, overdue: false };
}

export function SalesChatter({ opportunityId, contactCrmId, contactName, contactEmail, staff, taskTypes = ["Call", "Email", "Demo", "Follow-up", "Proposal"] }: {
  opportunityId?: string; contactCrmId?: string | null; contactName?: string | null; contactEmail?: string | null; staff: Staff[]; taskTypes?: string[];
}) {
  const [tab, setTab] = useState<Tab>("note");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState({ title: "", taskType: taskTypes[0] ?? "Call", dueDate: "", assigneeId: "" });

  const idQ = opportunityId ? `opportunityId=${opportunityId}` : contactCrmId ? `contactCrmId=${encodeURIComponent(contactCrmId)}` : "";

  const load = useCallback(async () => {
    if (!idQ) return;
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`/api/sales/chatter?${idQ}`),
        fetch(`/api/sales/tasks?scope=all&${idQ}`),
      ]);
      const a = aRes.ok ? await aRes.json() : { activity: [] };
      const t = tRes.ok ? await tRes.json() : { tasks: [] };
      setActivity(a.activity ?? []);
      setTasks((t.tasks ?? []) as Task[]);
    } catch { /* leave as-is */ }
  }, [idQ]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  function flash(kind: "ok" | "err", msg: string) {
    if (kind === "ok") { setOk(msg); setErr(null); } else { setErr(msg); setOk(null); }
    setTimeout(() => { setOk(null); setErr(null); }, 4000);
  }

  async function sendMessage() {
    if (!contactEmail) { flash("err", "This contact has no email."); return; }
    if (!subject.trim() || !body.trim()) { flash("err", "Add a subject and message."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/google/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: contactEmail, subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash("err", data.error ?? "Couldn't send — connect Google in Settings."); return; }
      setSubject(""); setBody(""); flash("ok", "Message sent."); await load();
    } catch { flash("err", "Send failed — please retry."); }
    finally { setBusy(false); }
  }

  async function logNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/chatter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note.trim(), opportunityId: opportunityId ?? null, contactCrmId: contactCrmId ?? null }),
      });
      if (!res.ok) { flash("err", "Couldn't save note."); return; }
      setNote(""); flash("ok", "Note logged."); await load();
    } finally { setBusy(false); }
  }

  async function addTask() {
    if (!task.title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title.trim(), taskType: task.taskType, dueDate: task.dueDate || null, assigneeId: task.assigneeId || null, opportunityId: opportunityId ?? null, contactCrmId: contactCrmId ?? null, contactName: contactName ?? null }),
      });
      if (!res.ok) { flash("err", "Couldn't create activity."); return; }
      setTask({ title: "", taskType: taskTypes[0] ?? "Call", dueDate: "", assigneeId: "" });
      flash("ok", "Activity scheduled."); await load();
    } finally { setBusy(false); }
  }

  async function taskDone(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }); await load(); }
    finally { setBusy(false); }
  }

  const planned = tasks.filter((t) => t.status !== "done");
  const tabBtn = (t: Tab, i: string, label: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t ? "#E6F1FB" : "transparent", color: tab === t ? "#185FA5" : "var(--muted-foreground)" });
  const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
  const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#185FA5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "8px 10px", borderBottom: "0.5px solid #eef1f5" }}>
        <button type="button" onClick={() => setTab("message")} style={tabBtn("message", "ti-mail", "")}><i className="ti ti-mail" aria-hidden="true" /> Send message</button>
        <button type="button" onClick={() => setTab("note")} style={tabBtn("note", "ti-note", "")}><i className="ti ti-note" aria-hidden="true" /> Log note</button>
        <button type="button" onClick={() => setTab("activity")} style={tabBtn("activity", "ti-clock-plus", "")}><i className="ti ti-clock-plus" aria-hidden="true" /> Activities</button>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "message" && (
          <>
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>To: {contactEmail ?? "no email on file"}</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={field} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message to the contact…" rows={4} style={field} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={sendMessage} disabled={busy || !contactEmail} style={{ ...primary, opacity: busy || !contactEmail ? 0.5 : 1 }}>Send</button></div>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Sends from your connected Google account and logs to the timeline. Connect Google in Settings if sending fails.</p>
          </>
        )}
        {tab === "note" && (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log an internal note (staff only)…" rows={3} style={field} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={logNote} disabled={busy || !note.trim()} style={{ ...primary, opacity: busy || !note.trim() ? 0.5 : 1 }}>Log note</button></div>
          </>
        )}
        {tab === "activity" && (
          <>
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Activity (e.g. Call follow-up)" style={field} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select value={task.taskType} onChange={(e) => setTask({ ...task, taskType: e.target.value })} style={{ ...field, width: "auto", flex: 1 }}>
                {taskTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} style={{ ...field, width: "auto", flex: 1 }} />
              <select value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })} style={{ ...field, width: "auto", flex: 1 }}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={addTask} disabled={busy || !task.title.trim()} style={{ ...primary, opacity: busy || !task.title.trim() ? 0.5 : 1 }}>Schedule</button></div>
          </>
        )}
        {(ok || err) && <p style={{ fontSize: 12, margin: 0, color: err ? "#A32D2D" : "#0F6E56" }}>{err ?? ok}</p>}
      </div>

      {planned.length > 0 && (
        <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Planned activities</div>
          {planned.map((t) => {
            const d = dueLabel(t.due_date);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: d.overdue ? "#FCEBEB" : "#FAEEDA", color: d.overdue ? "#A32D2D" : "#854F0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-clock" aria-hidden="true" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--foreground)" }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: d.overdue ? "#A32D2D" : "var(--muted-foreground)" }}>{t.task_type} · {d.text}{t.assignee_name ? ` · ${t.assignee_name}` : ""}</div>
                </div>
                <button type="button" onClick={() => taskDone(t.id)} disabled={busy} style={{ fontSize: 11, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /> Done</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>History</div>
        {activity.length === 0 ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>No activity yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activity.map((a) => {
              const ic = icon(a.kind);
              return (
                <div key={a.id} style={{ display: "flex", gap: 9 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--foreground)" }}>{a.summary}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{a.actor_name ? `${a.actor_name} · ` : ""}{ago(a.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
