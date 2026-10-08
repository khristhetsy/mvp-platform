"use client";

/**
 * Odoo-style chatter for the Sales Hub: Send message / Log note / Activities, then the
 * history split into Notes, Messages and System activity. Notes (iCapOS and Odoo) can
 * be edited and deleted, with a 10 second Undo and a "Recently deleted" list.
 * Self-contained: it fetches its own activity + tasks and reuses existing endpoints
 * (Gmail send, /api/sales/tasks, /api/sales/chatter), so it can be dropped onto both
 * the opportunity and contact detail without touching their state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { postScheduled, ScheduleSendMenu } from "@/components/email/ScheduleSend";
import { formatSendAt } from "@/lib/scheduled-emails/time";
import { TaskEditRow } from "./TaskEditRow";

type Activity = {
  id: string; kind: string; summary: string; actor_name: string | null; created_at: string;
  group?: "note" | "message" | "system"; source?: "icapos" | "odoo"; origin?: string | null;
  editable?: boolean; edited_at?: string | null; deleted_at?: string | null; odoo_synced?: boolean; via?: string | null;
};
type Via = "icapos" | "gmail";
type Senders = { icapos: { from: string; personal: boolean }; gmail: { connected: boolean; canSend: boolean; email: string | null } };
const VIA_KEY = "icapos.sales.sendVia";
function readVia(): Via | null { try { const v = window.localStorage.getItem(VIA_KEY); return v === "icapos" || v === "gmail" ? v : null; } catch { return null; } }
function saveVia(v: Via) { try { window.localStorage.setItem(VIA_KEY, v); } catch { /* storage unavailable */ } }
type OdooTarget = { model: string; id: number; label: string } | null;
type Undo =
  | { type: "delete"; id: string; label: string; left: number }
  | { type: "edit"; id: string; prevText: string; prevEditedAt: string | null; left: number };
const UNDO_SECONDS = 10;
type Task = { id: string; title: string; task_type: string; due_date: string | null; status: string; assignee_name: string | null; assignee_id?: string | null };
type Staff = { id: string; name: string };
type Tab = "message" | "note" | "activity";

const KIND_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  email: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  email_draft: { icon: "ti-mail", color: "#854F0B", bg: "#FAEEDA" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  odoo_message: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  odoo_note: { icon: "ti-note", color: "#854D0E", bg: "#FEF9C3" },
  note_edited: { icon: "ti-pencil", color: "#5F5E5A", bg: "#F1EFE8" },
  note_deleted: { icon: "ti-trash", color: "#5F5E5A", bg: "#F1EFE8" },
  note_restored: { icon: "ti-restore", color: "#5F5E5A", bg: "#F1EFE8" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  stage_changed: { icon: "ti-arrow-right", color: "#5F5E5A", bg: "#F1EFE8" },
  won: { icon: "ti-trophy", color: "#0F6E56", bg: "#E1F5EE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  converted: { icon: "ti-refresh", color: "#185FA5", bg: "#E6F1FB" },
  outreach_queued: { icon: "ti-clock", color: "#5F5E5A", bg: "#F1EFE8" },
  outreach_sent: { icon: "ti-send", color: "#0F6E56", bg: "#E1F5EE" },
  intro: { icon: "ti-arrows-exchange", color: "#185FA5", bg: "#E6F1FB" },
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

const NOTE_KINDS = new Set(["note", "opp_note", "odoo_note"]);
const MESSAGE_KINDS = new Set(["email", "email_draft", "message", "call", "odoo_message"]);
function groupOf(a: Activity): "note" | "message" | "system" {
  if (a.group) return a.group;
  return NOTE_KINDS.has(a.kind) ? "note" : MESSAGE_KINDS.has(a.kind) ? "message" : "system";
}
function callTemplate(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return `Conference call with ${first}\n\nRevenue:\nSeeking:\nValuation:\nUse of funds:\nExit:\nNote: `;
}
function firstLine(t: string): string { const l = t.trim().split("\n")[0] ?? ""; return l.length > 60 ? `${l.slice(0, 57)}...` : l; }

export function SalesChatter({ opportunityId, contactCrmId, contactName, contactEmail, staff, taskTypes = ["Call", "Email", "Demo", "Follow-up", "Proposal"] }: {
  opportunityId?: string; contactCrmId?: string | null; contactName?: string | null; contactEmail?: string | null; staff: Staff[]; taskTypes?: string[];
}) {
  const [tab, setTab] = useState<Tab>("note");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [odooTarget, setOdooTarget] = useState<OdooTarget>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [senders, setSenders] = useState<Senders | null>(null);
  const [via, setVia] = useState<Via>("icapos");
  const [note, setNote] = useState("");
  const [syncOdoo, setSyncOdoo] = useState(true);
  const [task, setTask] = useState({ title: "", taskType: taskTypes[0] ?? "Call", dueDate: "", assigneeId: "" });

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleted, setDeleted] = useState<Activity[]>([]);
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const idQ = opportunityId ? `opportunityId=${opportunityId}` : contactCrmId ? `contactCrmId=${encodeURIComponent(contactCrmId)}` : "";
  const scopeQ = [opportunityId ? `opportunityId=${opportunityId}` : "", contactCrmId ? `contactCrmId=${encodeURIComponent(contactCrmId)}` : ""].filter(Boolean).join("&");
  const scopeBody = { opportunityId: opportunityId ?? null, contactCrmId: contactCrmId ?? null };

  const loadDeleted = useCallback(async () => {
    if (!scopeQ) return;
    try {
      const res = await fetch(`/api/sales/chatter?${scopeQ}&deleted=1`);
      const d = res.ok ? await res.json() : { deleted: [] };
      setDeleted((d.deleted ?? []) as Activity[]);
    } catch { /* leave as-is */ }
  }, [scopeQ]);

  const load = useCallback(async () => {
    if (!idQ) return;
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`/api/sales/chatter?${scopeQ}`),
        fetch(`/api/sales/tasks?scope=all&${idQ}`),
      ]);
      const a = aRes.ok ? await aRes.json() : { activity: [] };
      const t = tRes.ok ? await tRes.json() : { tasks: [] };
      setActivity(a.activity ?? []);
      setOdooTarget((a.odooTarget ?? null) as OdooTarget);
      setTasks((t.tasks ?? []) as Task[]);
    } catch { /* leave as-is */ }
  }, [idQ, scopeQ]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (undoTimer.current) clearInterval(undoTimer.current); }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/sales/chatter/send").then((r) => (r.ok ? r.json() : null)).then((d: Senders | null) => {
      if (!live || !d) return;
      setSenders(d);
      // Last choice wins; otherwise Gmail when it can send, else iCapOS.
      setVia(readVia() ?? (d.gmail.canSend ? "gmail" : "icapos"));
    }).catch(() => { /* keep defaults */ });
    return () => { live = false; };
  }, []);

  function flash(kind: "ok" | "err", msg: string) {
    if (kind === "ok") { setOk(msg); setErr(null); } else { setErr(msg); setOk(null); }
    setTimeout(() => { setOk(null); setErr(null); }, 4000);
  }

  function startUndo(u: Undo) {
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndo(u);
    undoTimer.current = setInterval(() => {
      setUndo((cur) => {
        if (!cur) return null;
        if (cur.left <= 1) { if (undoTimer.current) clearInterval(undoTimer.current); return null; }
        return { ...cur, left: cur.left - 1 };
      });
    }, 1000);
  }
  function clearUndo() { if (undoTimer.current) clearInterval(undoTimer.current); setUndo(null); }

  async function noteRequest(id: string, init: RequestInit): Promise<Activity | null> {
    const res = await fetch(`/api/sales/chatter/notes/${encodeURIComponent(id)}${init.method === "DELETE" ? `?${scopeQ}` : ""}`, {
      ...init, headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { flash("err", data.error ?? "Something went wrong. Try again."); return null; }
    return (data.note ?? null) as Activity | null;
  }

  async function saveEdit() {
    if (!editing) return;
    const item = activity.find((a) => a.id === editing.id);
    if (!item) { setEditing(null); return; }
    const text = editing.text.trim();
    if (!text) { flash("err", "A note can't be empty. Delete it instead."); return; }
    if (text === item.summary.trim()) { setEditing(null); return; }
    setBusy(true);
    try {
      const saved = await noteRequest(item.id, { method: "PATCH", body: JSON.stringify({ action: "edit", text, ...scopeBody }) });
      if (!saved) return;
      setEditing(null);
      startUndo({ type: "edit", id: saved.id, prevText: item.summary, prevEditedAt: item.edited_at ?? null, left: UNDO_SECONDS });
      await load();
    } finally { setBusy(false); }
  }

  async function removeNote(item: Activity) {
    setBusy(true);
    setActivity((cur) => cur.filter((a) => a.id !== item.id));
    try {
      const gone = await noteRequest(item.id, { method: "DELETE" });
      if (!gone) { await load(); return; }
      startUndo({ type: "delete", id: gone.id, label: firstLine(item.summary), left: UNDO_SECONDS });
      await load();
      if (showDeleted) await loadDeleted();
    } finally { setBusy(false); }
  }

  async function restore(id: string) {
    setBusy(true);
    try {
      const back = await noteRequest(id, { method: "PATCH", body: JSON.stringify({ action: "restore", ...scopeBody }) });
      if (back) { flash("ok", "Note restored."); await Promise.all([load(), showDeleted ? loadDeleted() : Promise.resolve()]); }
    } finally { setBusy(false); }
  }

  async function runUndo() {
    const u = undo;
    if (!u) return;
    clearUndo();
    if (u.type === "delete") { await restore(u.id); return; }
    setBusy(true);
    try {
      const back = await noteRequest(u.id, { method: "PATCH", body: JSON.stringify({ action: "edit", text: u.prevText, undo: { editedAt: u.prevEditedAt }, ...scopeBody }) });
      if (back) await load();
    } finally { setBusy(false); }
  }

  async function toggleDeleted() {
    const next = !showDeleted;
    setShowDeleted(next);
    if (next) await loadDeleted();
  }

  function pickVia(v: Via) { setVia(v); saveVia(v); }

  async function sendMessage() {
    if (!contactEmail) { flash("err", "This contact has no email."); return; }
    if (!subject.trim() || !body.trim()) { flash("err", "Add a subject and message."); return; }
    if (via === "gmail" && senders && !senders.gmail.canSend) { flash("err", "Gmail isn't ready. Connect Google, or send via iCapOS."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/sales/chatter/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via, to: contactEmail, toName: contactName ?? null, cc: cc.trim() || null, subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash("err", data.error ?? "Couldn't send. Try again."); return; }
      setSubject(""); setBody(""); setCc(""); setShowCc(false);
      flash("ok", via === "icapos" ? "Sent via iCapOS. Replies will land in your iCapOS inbox." : "Sent via Gmail.");
      await load();
    } catch { flash("err", "Send failed. Try again."); }
    finally { setBusy(false); }
  }

  /** Schedule send: the same send, made at that time; listed on Sales › Scheduled emails. */
  async function scheduleMessage(sendAt: string): Promise<string | null> {
    if (!contactEmail) return "This contact has no email.";
    if (!subject.trim() || !body.trim()) return "Add a subject and message.";
    if (via === "gmail" && senders && !senders.gmail.canSend) return "Gmail isn't ready. Connect Google, or send via iCapOS.";
    const r = await postScheduled("/api/sales/chatter/send", { via, to: contactEmail, toName: contactName ?? null, cc: cc.trim() || null, subject: subject.trim(), body: body.trim() }, sendAt);
    if ("error" in r) return r.error;
    setSubject(""); setBody(""); setCc(""); setShowCc(false);
    flash("ok", `Scheduled for ${formatSendAt(r.sendAt)} via ${via === "icapos" ? "iCapOS" : "Gmail"}. Change or cancel it on Sales › Scheduled emails.`);
    return null;
  }

  async function logNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/chatter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note.trim(), ...scopeBody, syncToOdoo: Boolean(odooTarget && syncOdoo) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash("err", data.error ?? "Couldn't save note."); return; }
      setNote("");
      if (odooTarget && syncOdoo && !data.odooSynced) flash("err", `Note saved here, but not in Odoo: ${data.odooError ?? "unknown error"}`);
      else flash("ok", data.odooSynced ? "Note logged here and in Odoo." : "Note logged.");
      await load();
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
  const notes = activity.filter((a) => groupOf(a) === "note");
  const messages = activity.filter((a) => groupOf(a) === "message");
  const system = activity.filter((a) => groupOf(a) === "system");
  const sectionLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" };
  const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 14, padding: 2, lineHeight: 1 };
  const ghostBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--foreground)", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 6, padding: "4px 10px", cursor: "pointer" };
  const viaBadge: React.CSSProperties = { fontSize: 10, color: "#185FA5", background: "#E6F1FB", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" };
  const odooBadge: React.CSSProperties = { fontSize: 10, color: "#6B21A8", background: "#F3E8FF", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" };
  const tabBtn = (t: Tab, _i: string, _label: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t ? "#E6F1FB" : "transparent", color: tab === t ? "#185FA5" : "var(--muted-foreground)" });
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", width: 58 }}>Send via</span>
              <div role="radiogroup" aria-label="Send via" style={{ display: "inline-flex", border: "0.5px solid #d7dbe3", borderRadius: 8, overflow: "hidden" }}>
                {(["icapos", "gmail"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={via === v} onClick={() => pickVia(v)} style={{ fontSize: 12, padding: "5px 12px", border: "none", cursor: "pointer", background: via === v ? "#E6F1FB" : "#fff", color: via === v ? "#185FA5" : "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i className={`ti ${v === "icapos" ? "ti-building" : "ti-brand-gmail"}`} aria-hidden="true" /> {v === "icapos" ? "iCapOS" : "Gmail"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, borderTop: "0.5px solid #eef1f5", paddingTop: 6, display: "flex", gap: 10 }}>
              <span style={{ color: "var(--muted-foreground)", width: 58, flexShrink: 0 }}>From</span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{via === "icapos" ? (senders?.icapos.from ?? "iCapOS") : (senders?.gmail.email ?? "Your Google account")}</span>
            </div>
            {via === "icapos" && senders && !senders.icapos.personal && (
              <div style={{ fontSize: 11, color: "#854F0B", paddingLeft: 68 }}>Sending from the iCapOS address with your name. To send from your own address, verify its domain in Resend.</div>
            )}
            <div style={{ fontSize: 12, display: "flex", gap: 10 }}>
              <span style={{ color: "var(--muted-foreground)", width: 58, flexShrink: 0 }}>Replies</span>
              <span style={{ color: "var(--muted-foreground)" }}>{via === "icapos" ? "Land in your iCapOS inbox" : "Land in your Gmail"}</span>
            </div>
            <div style={{ fontSize: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "var(--muted-foreground)", width: 58, flexShrink: 0 }}>To</span>
              <span style={{ flex: 1 }}>{contactEmail ?? "no email on file"}</span>
              {!showCc && <button type="button" onClick={() => setShowCc(true)} style={{ fontSize: 11.5, color: "#185FA5", background: "none", border: "none", cursor: "pointer" }}>Cc</button>}
            </div>
            {showCc && <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc (comma separated)" style={field} />}
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={field} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message to the contact…" rows={4} style={field} />
            {via === "gmail" && senders && !senders.gmail.canSend && (
              <div style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", borderRadius: 8, padding: "8px 10px" }}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" /> {senders.gmail.connected ? "Gmail send permission isn't granted." : "Gmail isn't connected for your account."}{" "}
                <a href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/admin/sales")}`} style={{ color: "#854F0B", textDecoration: "underline" }}>Connect Google</a> or send via iCapOS.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{via === "icapos" ? "Sent by iCapOS with your saved signature. Logged to the timeline." : "Sent from your Gmail and shown in its Sent folder. Logged to the timeline."}</span>
              <span style={{ display: "inline-flex" }}>
                <button type="button" onClick={sendMessage} disabled={busy || !contactEmail} style={{ ...primary, borderRadius: "8px 0 0 8px", opacity: busy || !contactEmail ? 0.5 : 1 }}>{via === "icapos" ? "Send via iCapOS" : "Send via Gmail"}</button>
                <ScheduleSendMenu placement="above" disabled={busy || !contactEmail} onSchedule={scheduleMessage}
                  chevronStyle={{ ...primary, borderRadius: "0 8px 8px 0", borderLeft: "0.5px solid rgba(255,255,255,.45)", padding: "8px 8px", display: "inline-flex", alignItems: "center", opacity: busy || !contactEmail ? 0.5 : 1 }} />
              </span>
            </div>
          </>
        )}
        {tab === "note" && (
          <div style={{ background: "#F4F5F7", border: "0.5px solid #E2E4E9", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11.5, color: "#5F5E5A" }}>
              <span><i className="ti ti-lock" aria-hidden="true" /> Internal note. Staff only, never sent to the contact.</span>
              {!note.trim() && <button type="button" onClick={() => setNote(callTemplate(contactName))} style={{ fontSize: 11.5, color: "#5F5E5A", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Use call template</button>}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log an internal note…" rows={note.includes("\n") ? 8 : 3} style={{ ...field, background: "#fff" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {odooTarget ? (
                <label style={{ fontSize: 11.5, color: "#5F5E5A", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={syncOdoo} onChange={(e) => setSyncOdoo(e.target.checked)} /> Also log in {odooTarget.label}
                </label>
              ) : <span />}
              <button type="button" onClick={logNote} disabled={busy || !note.trim()} style={{ ...primary, opacity: busy || !note.trim() ? 0.5 : 1 }}>Log note</button>
            </div>
          </div>
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
            if (editTaskId === t.id) {
              return <TaskEditRow key={t.id} task={t} staff={staff} taskTypes={taskTypes} onCancel={() => setEditTaskId(null)} onSaved={async () => { setEditTaskId(null); flash("ok", "Activity updated."); await load(); }} />;
            }
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: d.overdue ? "#FCEBEB" : "#FAEEDA", color: d.overdue ? "#A32D2D" : "#854F0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-clock" aria-hidden="true" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--foreground)" }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: d.overdue ? "#A32D2D" : "var(--muted-foreground)" }}>{t.task_type} · {d.text}{t.assignee_name ? ` · ${t.assignee_name}` : ""}</div>
                </div>
                {/* Odoo activities can only be completed here, not edited. */}
                {!t.id.startsWith("odoo:") && <button type="button" onClick={() => setEditTaskId(t.id)} disabled={busy} style={{ fontSize: 11, color: "#185FA5", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-pencil" aria-hidden="true" /> Edit</button>}
                <button type="button" onClick={() => taskDone(t.id)} disabled={busy} style={{ fontSize: 11, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /> Done</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes */}
      <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={sectionLabel}>Notes</div>
          <button type="button" onClick={toggleDeleted} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
            <i className="ti ti-trash" aria-hidden="true" /> Recently deleted{showDeleted ? ` · ${deleted.length}` : ""} <i className={`ti ${showDeleted ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
          </button>
        </div>

        {showDeleted && (
          <div style={{ border: "0.5px dashed #d7dbe3", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            {deleted.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: 0 }}>No notes deleted in the last 30 days.</p> : deleted.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstLine(d.summary)} · deleted {d.deleted_at ? ago(d.deleted_at) : ""}</span>
                <button type="button" onClick={() => restore(d.id)} disabled={busy} style={ghostBtn}>Restore</button>
              </div>
            ))}
          </div>
        )}

        {undo && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, background: "#F1EFE8", color: "#444441", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
            <span><i className={`ti ${undo.type === "delete" ? "ti-trash" : "ti-pencil"}`} aria-hidden="true" /> {undo.type === "delete" ? `Note deleted: ${undo.label}` : "Note edited"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>{undo.left}s <button type="button" onClick={runUndo} disabled={busy} style={ghostBtn}>Undo</button></span>
          </div>
        )}

        {notes.length === 0 ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>No notes yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((a) => {
              const ic = icon(a.kind);
              const isEditing = editing?.id === a.id;
              return (
                <div key={a.id} style={{ display: "flex", gap: 9 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{a.actor_name ? `${a.actor_name} · ` : ""}{ago(a.created_at)}{a.edited_at ? " · edited" : ""}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {a.source === "odoo" ? <span style={odooBadge}><i className="ti ti-refresh" aria-hidden="true" /> {a.origin ?? "Odoo"}</span> : null}
                        {a.odoo_synced ? <span style={odooBadge}><i className="ti ti-check" aria-hidden="true" /> Also in Odoo</span> : null}
                        {a.editable !== false && !isEditing && (
                          <>
                            <button type="button" aria-label="Edit note" title="Edit" onClick={() => setEditing({ id: a.id, text: a.summary })} disabled={busy} style={iconBtn}><i className="ti ti-pencil" aria-hidden="true" /></button>
                            <button type="button" aria-label="Delete note" title="Delete" onClick={() => removeNote(a)} disabled={busy} style={iconBtn}><i className="ti ti-trash" aria-hidden="true" /></button>
                          </>
                        )}
                      </span>
                    </div>
                    {isEditing ? (
                      <div style={{ marginTop: 4 }}>
                        <textarea value={editing.text} onChange={(e) => setEditing({ id: a.id, text: e.target.value })} rows={Math.min(12, Math.max(3, editing.text.split("\n").length + 1))} style={field} autoFocus />
                        {a.source === "odoo" && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "4px 0 0" }}>Your edit shows in iCapOS. The note in Odoo keeps its original text.</p>}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                          <button type="button" onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
                          <button type="button" onClick={saveEdit} disabled={busy || !editing.text.trim()} style={{ ...primary, padding: "5px 12px", fontSize: 12, opacity: busy || !editing.text.trim() ? 0.5 : 1 }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "var(--foreground)", whiteSpace: "pre-wrap", marginTop: 2, lineHeight: 1.55 }}>{a.summary}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>Messages</div>
        {messages.length === 0 ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>No messages yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((a) => {
              const ic = icon(a.kind);
              return (
                <div key={a.id} style={{ display: "flex", gap: 9 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{a.summary}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{a.actor_name ? `${a.actor_name} · ` : ""}{ago(a.created_at)}</span>
                      {a.source === "odoo" || a.kind === "odoo_message" ? <span style={odooBadge}><i className="ti ti-refresh" aria-hidden="true" /> {a.origin ?? "Odoo"}</span> : null}
                      {a.via === "icapos" ? <span style={viaBadge}><i className="ti ti-building" aria-hidden="true" /> via iCapOS</span> : a.via === "gmail" ? <span style={viaBadge}><i className="ti ti-brand-gmail" aria-hidden="true" /> via Gmail</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* System activity */}
      <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
        <div style={{ ...sectionLabel, marginBottom: 6 }}>System activity</div>
        {system.length === 0 ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Nothing yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {system.map((a) => (
              <div key={a.id} style={{ fontSize: 11.5, color: "var(--muted-foreground)", display: "flex", gap: 6 }}>
                <i className={`ti ${icon(a.kind).icon}`} aria-hidden="true" style={{ marginTop: 2 }} />
                <span style={{ minWidth: 0 }}>{a.summary} · {a.actor_name ? `${a.actor_name} · ` : ""}{ago(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
