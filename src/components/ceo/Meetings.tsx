"use client";

import { useMemo, useState } from "react";
import type { CeoMeeting, CeoSession } from "@/lib/ceo/meetings";

const navy = "#0A1A40", royal = "#1A6CE4";
const DAY = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch { return { ok: false, data: {} }; }
}

const inp: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid #E4E8F0", background: "#fff", color: navy, width: "100%", boxSizing: "border-box" };

/* ── Workflow card (head + calendar + before/during/after + rules + journal) ── */

export function MeetingWorkflowCard({ meeting, sessions, onRefresh }: { meeting: CeoMeeting; sessions: CeoSession[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mine = sessions.filter((s) => s.meetingKey === meeting.key);

  async function sync() {
    setBusy(true); setMsg(null);
    const { ok, data } = await api(`/api/ceo/meetings/${meeting.key}/calendar`, "POST");
    setBusy(false);
    if (ok) { setMsg("Calendar event created."); onRefresh(); }
    else setMsg((data as { error?: string }).error ?? "Calendar sync failed.");
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ background: `linear-gradient(120deg,${navy},#12275C 60%,${royal} 150%)`, color: "#fff", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{meeting.name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[DAY[meeting.dayOfWeek], `${meeting.durationMin} min`, meeting.timeLocal].map((t) => <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,.12)", color: "#DCE6F8" }}>{t}</span>)}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {meeting.gcalEventId ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "#B9F6CA" }}>✓ Calendar synced</span>
              : <button onClick={sync} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: navy, background: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy ? "Syncing…" : "Sync to Google Calendar"}</button>}
          </div>
        </div>
        {msg && <div style={{ fontSize: 11.5, marginTop: 8, color: msg.includes("created") ? "#B9F6CA" : "#FFCDD2" }}>{msg}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, padding: 16 }}>
        <Phase title="Before" items={meeting.workflow.before} />
        <Phase title="During" items={meeting.agenda.map((a) => `${a.title}${a.minutes ? ` · ${a.minutes}m` : ""}`)} />
        <Phase title="After" items={meeting.workflow.after} />
      </div>
      {meeting.workflow.rules && <div style={{ fontSize: 11.5, color: "#6B7690", padding: "0 16px 14px", lineHeight: 1.6 }}><b>Rules:</b> {meeting.workflow.rules}</div>}

      <SessionJournal meetingKey={meeting.key} sessions={mine} onRefresh={onRefresh} />
    </div>
  );
}

function Phase({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".9px", textTransform: "uppercase", color: royal, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: navy, lineHeight: 1.6 }}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}

/* ── Session journal (add / edit / delete) ── */

function SessionJournal({ meetingKey, sessions, onRefresh }: { meetingKey: string; sessions: CeoSession[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({ sessionDate: today, attendance: "", note: "", decisions: "", tasks: "" });

  async function addSession() {
    setBusy(true);
    const body = { sessionDate: draft.sessionDate, attendance: draft.attendance || null, note: draft.note || null, decisions: lines(draft.decisions), tasks: lines(draft.tasks) };
    const { ok } = await api(`/api/ceo/meetings/${meetingKey}/sessions`, "POST", body);
    setBusy(false);
    if (ok) { setAdding(false); setDraft({ sessionDate: today, attendance: "", note: "", decisions: "", tasks: "" }); onRefresh(); }
  }

  return (
    <div style={{ borderTop: "1px solid #F1F4F9", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".9px", textTransform: "uppercase", color: "#6B7690" }}>Session log</div>
        <button onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#fff", background: navy, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>{adding ? "Cancel" : "+ New entry"}</button>
      </div>

      {adding && (
        <div style={{ background: "#F6F8FB", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={draft.sessionDate} onChange={(e) => setDraft({ ...draft, sessionDate: e.target.value })} style={{ ...inp, width: "auto" }} />
            <input placeholder="Attendance (e.g. 5/5 present)" value={draft.attendance} onChange={(e) => setDraft({ ...draft, attendance: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
          </div>
          <textarea placeholder="Session narrative…" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
          <textarea placeholder="Decisions — one per line" value={draft.decisions} onChange={(e) => setDraft({ ...draft, decisions: e.target.value })} style={{ ...inp, minHeight: 44, resize: "vertical" }} />
          <textarea placeholder="Tasks — one per line (sync to the Admin task board)" value={draft.tasks} onChange={(e) => setDraft({ ...draft, tasks: e.target.value })} style={{ ...inp, minHeight: 44, resize: "vertical" }} />
          <button onClick={addSession} disabled={busy} style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Saving…" : "Save entry"}</button>
        </div>
      )}

      {sessions.length === 0 && !adding && <div style={{ fontSize: 12, color: "#6B7690" }}>No sessions logged yet.</div>}
      {sessions.map((s) => (
        <SessionEntry key={s.id} session={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} editing={editId === s.id} onEdit={() => setEditId(editId === s.id ? null : s.id)} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function SessionEntry({ session, open, onToggle, editing, onEdit, onRefresh }: { session: CeoSession; open: boolean; onToggle: () => void; editing: boolean; onEdit: () => void; onRefresh: () => void }) {
  const [note, setNote] = useState(session.note ?? "");
  const [attendance, setAttendance] = useState(session.attendance ?? "");
  const [decisions, setDecisions] = useState((session.decisions ?? []).join("\n"));
  const [busy, setBusy] = useState(false);

  async function save() { setBusy(true); const { ok } = await api(`/api/ceo/sessions/${session.id}`, "PATCH", { note: note || null, attendance: attendance || null, decisions: lines(decisions) }); setBusy(false); if (ok) { onEdit(); onRefresh(); } }
  async function del() { if (!confirm("Delete this journal entry?")) return; const { ok } = await api(`/api/ceo/sessions/${session.id}`, "DELETE"); if (ok) onRefresh(); }

  return (
    <div style={{ border: "1px solid #E4E8F0", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: navy }}>{new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        {session.attendance && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#EEF1F7", color: "#6B7690" }}>{session.attendance}</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#98A2B3" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={attendance} onChange={(e) => setAttendance(e.target.value)} placeholder="Attendance" style={inp} />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
              <textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="Decisions — one per line" style={{ ...inp, minHeight: 44, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={save} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>{busy ? "Saving…" : "Save"}</button>
                <button onClick={onEdit} style={{ fontSize: 12, color: "#6B7690", background: "transparent", border: "1px solid #E4E8F0", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {session.note && <div style={{ fontSize: 12.5, color: navy, lineHeight: 1.6 }}>{session.note}</div>}
              {session.decisions.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "#6B7690", letterSpacing: ".6px", marginBottom: 3 }}>Decisions</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>{session.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={onEdit} style={{ fontSize: 11.5, color: royal, background: "#EEF3FC", border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>Edit</button>
                <button onClick={del} style={{ fontSize: 11.5, color: "#D6455D", background: "#FCE9EC", border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>Delete</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Meeting Log (all sessions, filters) ── */

export function MeetingLog({ meetings, sessions }: { meetings: CeoMeeting[]; sessions: CeoSession[] }) {
  const [filter, setFilter] = useState("all");
  const nameByKey = useMemo(() => new Map(meetings.map((m) => [m.key, m.name])), [meetings]);
  const filters: [string, string][] = [["all", "All"], ["sales", "Sales"], ["mktg", "Marketing"], ["operations", "Operations"], ["mgmt", "Management"], ["staff", "Staff"]];

  const shown = sessions.filter((s) => {
    if (filter === "all") return true;
    if (filter === "operations") return s.meetingKey === "mgmt" || s.meetingKey === "staff";
    return s.meetingKey === filter;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {filters.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 99, border: "none", cursor: "pointer", background: filter === k ? royal : "#EEF1F7", color: filter === k ? "#fff" : "#6B7690" }}>{l}</button>)}
      </div>
      {shown.length === 0 ? <div style={{ fontSize: 12.5, color: "#6B7690" }}>No sessions logged yet.</div> : (
        <div style={{ position: "relative", paddingLeft: 24 }}>
          <div style={{ position: "absolute", left: 8, top: 4, bottom: 4, width: 1.5, background: "#E4E8F0" }} />
          {shown.map((s) => (
            <div key={s.id} style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: -22, top: 3, width: 14, height: 14, borderRadius: 99, background: "#fff", border: `2px solid ${royal}` }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7690", textTransform: "uppercase", letterSpacing: ".6px" }}>{new Date(`${s.sessionDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {nameByKey.get(s.meetingKey) ?? s.meetingKey}</div>
              {s.note && <div style={{ fontSize: 12.5, color: navy, marginTop: 3, lineHeight: 1.55 }}>{s.note}</div>}
              {s.decisions.length > 0 && <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 4 }}>Decisions: {s.decisions.join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function lines(s: string): string[] { return s.split("\n").map((x) => x.trim()).filter(Boolean); }
