"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Contact = {
  id: string; source: string; name: string; email: string | null; company: string | null; phone: string | null; phone2: string | null;
  website: string | null; lead_status: string | null; lead_source: string | null; tags: string[]; owner: string | null; membership: string | null;
  job_position: string | null; street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null;
  country: string | null; language: string | null; created_on: string | null; note: string | null;
};
type LinkedOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; probability: number | null; status: string };
type Staff = { id: string; name: string };
type Activity = { id: string; kind: string; summary: string; actor_name: string | null; created_at: string };
const LEAD_STATUSES = ["new", "contacted", "qualified", "paused", "not interested", "won", "lost"];
const ACT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  email: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  contact_edit: { icon: "ti-edit", color: "#5F5E5A", bg: "#F1EFE8" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  converted: { icon: "ti-arrow-right", color: "#185FA5", bg: "#E6F1FB" },
  stage_changed: { icon: "ti-arrow-right", color: "#854F0B", bg: "#FAEEDA" },
  won: { icon: "ti-trophy", color: "#3B6D11", bg: "#EAF3DE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  email_draft: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
};
function actWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const outlineBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" };

function Field({ k, v, link }: { k: string; v: string | null; link?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: 11.5 }}>
      <span style={{ width: 118, color: "var(--muted-foreground)", flexShrink: 0 }}>{k}</span>
      <span style={{ color: link && v ? "#185FA5" : "var(--foreground)" }}>{v || "—"}</span>
    </div>
  );
}

export function ContactProfileClient({ contact: initialContact, opportunities, staff, activity }: { contact: Contact; opportunities: LinkedOpp[]; staff: Staff[]; activity: Activity[] }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact>(initialContact);
  const [note, setNote] = useState("");
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [task, setTask] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [savedNotes, setSavedNotes] = useState<string | null>(initialContact.note);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ lead_status: initialContact.lead_status ?? "new", phone: initialContact.phone ?? "", website: initialContact.website ?? "", owner: initialContact.owner ?? "", tags: initialContact.tags.join(", ") });
  const [section, setSection] = useState<"details" | "activity">("details");
  const [actFilter, setActFilter] = useState<"all" | "call" | "note" | "task" | "stage">("all");
  const [acts, setActs] = useState<Activity[]>(activity);
  const [call, setCall] = useState({ outcome: "connected", duration: "", notes: "" });

  async function logTouch(channel: "email" | "message") {
    try {
      await fetch(`/api/sales/contacts/${contact.id}/touch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      const summary = channel === "email" ? "Email opened" : "Text message opened";
      setActs((p) => [{ id: `tmp-${Date.now()}`, kind: channel, summary, actor_name: "You", created_at: new Date().toISOString() }, ...p]);
    } catch { /* ignore */ }
  }

  async function logCall() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(call) });
      if (res.ok) {
        const label: Record<string, string> = { connected: "connected", voicemail: "voicemail", no_answer: "no answer", wrong_number: "wrong number" };
        const parts = [`Call — ${label[call.outcome]}`];
        if (call.duration) parts.push(call.duration);
        if (call.notes) parts.push(`"${call.notes.trim()}"`);
        setActs((p) => [{ id: `tmp-${Date.now()}`, kind: "call", summary: parts.join(" · "), actor_name: "You", created_at: new Date().toISOString() }, ...p]);
        setCall({ outcome: "connected", duration: "", notes: "" });
      }
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const body = { lead_status: form.lead_status, phone: form.phone || null, website: form.website || null, owner: form.owner || null, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setContact({ ...contact, ...body }); setEditing(false); }
    } finally { setBusy(false); }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true); setNoteMsg(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setSavedNotes((prev) => (prev ? `${prev}\n[${new Date().toISOString().slice(0, 10)}] ${note}` : `[${new Date().toISOString().slice(0, 10)}] ${note}`));
      setNote(""); setNoteMsg("Saved.");
    } catch (e) { setNoteMsg(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }
  async function createTask() {
    if (!task.title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: task.title, taskType: task.taskType, dueDate: task.dueDate || null, assigneeId: task.assigneeId || null, contactCrmId: contact.id, contactName: contact.name }) });
      setShowTask(false); setTask({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
    } finally { setBusy(false); }
  }

  const address = [contact.street, contact.street2, contact.city, contact.state, contact.zip, contact.country].filter(Boolean).join(", ") || null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/sales/contacts" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Contacts</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{contact.name}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Header + smart buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>{contact.name.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{contact.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{[contact.job_position, contact.company].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div style={{ textAlign: "center", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 10, color: "#185FA5" }}><i className="ti ti-target" aria-hidden="true" /> Opportunities</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{opportunities.length}</div>
          </div>
          {contact.phone
            ? <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-phone" aria-hidden="true" /> Call</a>
            : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-phone" aria-hidden="true" /> Call</span>}
          {contact.email
            ? <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("email")} style={{ fontSize: 11.5, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email</a>
            : <span title="No email on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-mail" aria-hidden="true" /> Email</span>}
          {contact.phone
            ? <a href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`} onClick={() => logTouch("message")} style={{ fontSize: 11.5, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Message</a>
            : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-message" aria-hidden="true" /> Message</span>}
          {!editing && <button onClick={() => setEditing(true)} style={outlineBtn}><i className="ti ti-edit" aria-hidden="true" /> Edit</button>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <button onClick={() => setSection("details")} style={{ fontSize: 12.5, fontWeight: section === "details" ? 600 : 400, color: section === "details" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "details" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Details</button>
          <button onClick={() => setSection("activity")} style={{ fontSize: 12.5, fontWeight: section === "activity" ? 600 : 400, color: section === "activity" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "activity" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Activity {acts.length ? `· ${acts.length}` : ""}</button>
        </div>

        {section === "details" && (<>
        {/* Field grid */}
        {editing ? (
          <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lead status</label><select value={form.lead_status} onChange={(e) => setForm({ ...form, lead_status: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 …" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Owner</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Tags (comma-separated)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
              <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ ...outlineBtn, padding: "8px 16px" }}>Cancel</button>
              <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", alignSelf: "center" }}>Edits save to your CRM mirror; an Odoo re-sync may overwrite them.</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Field k="Membership" v={contact.membership} />
                <Field k="Job position" v={contact.job_position} />
                <Field k="Lead status" v={contact.lead_status} />
                <Field k="Lead source" v={contact.lead_source} />
                <Field k="Owner" v={contact.owner} />
                <Field k="Source" v={contact.source} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Field k="Phone" v={contact.phone} />
                <Field k="Phone 2" v={contact.phone2} />
                <Field k="Email" v={contact.email} link />
                <Field k="Website" v={contact.website} link />
                <Field k="Language" v={contact.language} />
                <Field k="Tags" v={contact.tags.length ? contact.tags.join(", ") : null} />
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Address</div>
              {address ? <div style={{ fontSize: 12, lineHeight: 1.6 }}>{address}</div> : <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</div>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 16px", borderTop: "0.5px solid #eef1f5", borderBottom: "0.5px solid #eef1f5" }}>
          <Link href={`/admin/sales/contacts/${contact.id}/convert`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", textDecoration: "none" }}><i className="ti ti-arrow-right" aria-hidden="true" /> Convert to opportunity</Link>
          <button onClick={() => setShowTask((v) => !v)} style={outlineBtn}><i className="ti ti-calendar-plus" aria-hidden="true" /> Create task</button>
        </div>

        {showTask && (
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 8, alignItems: "center" }}>
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Task title" autoFocus style={inp} />
            <select value={task.taskType} onChange={(e) => setTask({ ...task, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
            <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} style={inp} />
            <select value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={createTask} disabled={busy || !task.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !task.title.trim() ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setShowTask(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        )}

        {/* Log note + timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "14px 16px" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log a note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button onClick={saveNote} disabled={busy || !note.trim()} style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy || !note.trim() ? 0.5 : 1 }}>Save note</button>
              {noteMsg && <span style={{ fontSize: 11, color: noteMsg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{noteMsg}</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>{savedNotes || "No notes yet."}</div>
          </div>
        </div>

        </>)}

        {section === "activity" && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {([["all", "All"], ["call", "Calls"], ["note", "Notes"], ["task", "Tasks"], ["stage", "Stage changes"]] as const).map(([f, label]) => (
              <button key={f} onClick={() => setActFilter(f)} style={{ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 14, padding: "3px 11px", background: actFilter === f ? "#2E78F5" : "var(--muted)", color: actFilter === f ? "#fff" : "var(--muted-foreground)" }}>{label}</button>
            ))}
          </div>

          {/* Log a call */}
          <div style={{ background: "#F5F9FF", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><i className="ti ti-phone" aria-hidden="true" style={{ color: "#0F6E56" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>Log a call</span><span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>after your Nextiva call</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 2fr auto", gap: 8, alignItems: "center" }}>
              <select value={call.outcome} onChange={(e) => setCall({ ...call, outcome: e.target.value })} style={inp}><option value="connected">Connected</option><option value="voicemail">Voicemail</option><option value="no_answer">No answer</option><option value="wrong_number">Wrong number</option></select>
              <input value={call.duration} onChange={(e) => setCall({ ...call, duration: e.target.value })} placeholder="Duration" style={inp} />
              <input value={call.notes} onChange={(e) => setCall({ ...call, notes: e.target.value })} placeholder="Call notes / outcome…" style={inp} />
              <button onClick={logCall} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Log</button>
            </div>
          </div>

          {(() => {
            const shown = acts.filter((a) => actFilter === "all" || (actFilter === "task" ? a.kind.startsWith("task") : actFilter === "stage" ? (a.kind === "stage_changed" || a.kind === "won" || a.kind === "lost") : actFilter === "note" ? (a.kind === "note" || a.kind === "opp_note") : a.kind === actFilter));
            if (shown.length === 0) return <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>No activity yet. Calls, notes, tasks, stage changes, and conversions appear here.</div>;
            return (
              <div style={{ position: "relative", paddingLeft: 26 }}>
                <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 1.5, background: "var(--border)" }} />
                {shown.map((a) => {
                  const ic = ACT_ICON[a.kind] ?? { icon: "ti-point", color: "#5F5E5A", bg: "#F1EFE8" };
                  return (
                    <div key={a.id} style={{ position: "relative", marginBottom: 14 }}>
                      <span style={{ position: "absolute", left: -24, top: 1, width: 18, height: 18, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></span>
                      <div style={{ fontSize: 12 }}>{a.summary}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{a.actor_name ?? "System"} · {actWhen(a.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        )}

        {/* Linked opportunities */}
        {section === "details" && opportunities.length > 0 && (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Linked opportunities</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {opportunities.map((o) => (
                <button key={o.id} onClick={() => router.push(`/admin/sales/opportunities/${o.id}`)} style={{ textAlign: "left", background: "var(--muted)", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{o.title}</span>
                  <span style={{ fontSize: 11, color: "#185FA5" }}>{money(o.value_cents)}{o.probability != null ? ` · ${o.probability}%` : ""}{o.stage_name ? ` · ${o.stage_name}` : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
