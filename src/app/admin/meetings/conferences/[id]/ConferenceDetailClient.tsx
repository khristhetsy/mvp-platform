"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
interface Session { id: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; speaker: string | null; session_url: string | null; position: number }
interface Conference {
  id: string; title: string; kind: string; description: string | null; start_date: string; end_date: string | null;
  timezone: string; location: string | null; event_url: string | null; department_name: string | null; host_name: string | null; status: string;
}
const KIND_LABEL: Record<string, string> = { conference: "Conference", summit: "Summit", talkshow: "Talk show", webinar: "Webinar" };

export function ConferenceDetailClient({ conference, sessions: initialSessions }: { conference: Conference | null; sessions: Session[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [adding, setAdding] = useState(false);

  if (!conference) return <p style={{ fontSize: 13, color: MUTED }}>Event not found.</p>;

  const setStatus = async (status: string) => {
    await fetch(`/api/admin/meetings/conferences/${conference.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    router.refresh();
  };
  const reload = async () => {
    const d = await fetch(`/api/admin/meetings/conferences/${conference.id}`).then((r) => r.json()).catch(() => null);
    if (d?.sessions) setSessions(d.sessions as Session[]);
  };
  const removeSession = async (id: string) => {
    setSessions((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/admin/meetings/conferences/sessions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div>
      <Link href="/admin/meetings/conferences" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Events</Link>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, margin: "6px 0 16px" }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "0 0 4px" }}>{conference.title}</h1>
          <div style={{ fontSize: 12.5, color: MUTED, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{KIND_LABEL[conference.kind] ?? conference.kind}</span>
            <span>·</span>
            <span>{fmtRange(conference.start_date, conference.end_date)}</span>
            {conference.location && <><span>·</span><span>{conference.location}</span></>}
            {conference.host_name && <><span>·</span><span>Host: {conference.host_name}</span></>}
            {conference.department_name && <><span>·</span><span>{conference.department_name}</span></>}
          </div>
          {conference.event_url && <a href={conference.event_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>{conference.event_url}</a>}
        </div>
        <select value={conference.status} onChange={(e) => void setStatus(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--border)", fontWeight: 600, color: NAVY }}>
          <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      {conference.description && <p style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, marginBottom: 16 }}>{conference.description}</p>}

      <ChecklistPanel conferenceId={conference.id} />

      <RegistrationsPanel conferenceId={conference.id} />


      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Agenda · {sessions.length} session{sessions.length === 1 ? "" : "s"}</div>
        <button onClick={() => setAdding(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Add session</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.length === 0 && !adding && <p style={{ fontSize: 12.5, color: MUTED }}>No sessions yet — add talks, panels, or segments to build the agenda.</p>}
        {sessions.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{s.title}</div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {s.starts_at && <span>{fmtTime(s.starts_at)}{s.ends_at ? ` – ${fmtTime(s.ends_at)}` : ""}</span>}
                  {s.speaker && <span>· {s.speaker}</span>}
                  {s.session_url && <a href={s.session_url} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, textDecoration: "none" }}>· link</a>}
                </div>
                {s.description && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{s.description}</div>}
              </div>
              <button onClick={() => void removeSession(s.id)} style={{ fontSize: 11, color: "#A32D2D", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        ))}
        {adding && <AddSessionForm conferenceId={conference.id} onDone={() => { setAdding(false); void reload(); }} onCancel={() => setAdding(false)} />}
      </div>
    </div>
  );
}

interface ChecklistTask { id: string; title: string; phase: string | null; due_date: string | null; status: string; department_name: string | null }
interface Template { id: string; name: string; event_kind: string; item_count: number }
const PHASE_ORDER = ["T-30", "T-14", "T-7", "T-1", "T+1"];

function ChecklistPanel({ conferenceId }: { conferenceId: string }) {
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [done, setDone] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/meetings/conferences/${conferenceId}/checklist`).then((r) => r.json()).then((d) => {
      setTasks((d.tasks ?? []) as ChecklistTask[]); setDone(d.done ?? 0);
    }).catch(() => {});
  }, [conferenceId]);
  useEffect(() => {
    load();
    fetch("/api/admin/meetings/conferences/checklist-templates").then((r) => r.json()).then((d) => setTemplates((d.templates ?? []) as Template[])).catch(() => {});
  }, [load]);

  const apply = async (templateId: string) => {
    setApplying(true);
    try {
      await fetch(`/api/admin/meetings/conferences/${conferenceId}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: templateId }) });
      load();
    } finally { setApplying(false); }
  };
  const toggle = async (task: ChecklistTask, checked: boolean) => {
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, status: checked ? "done" : "not_started" } : t)));
    setDone((d) => d + (checked ? 1 : -1));
    await fetch(`/api/admin/meetings/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: checked ? "done" : "not_started" }) }).catch(() => {});
  };

  const today = new Date().toISOString().slice(0, 10);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const byPhase = new Map<string, ChecklistTask[]>();
  for (const t of tasks) { const k = t.phase ?? "—"; const a = byPhase.get(k) ?? []; a.push(t); byPhase.set(k, a); }
  const phases = [...byPhase.keys()].sort((a, b) => (PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b)) || a.localeCompare(b));

  if (tasks.length === 0) {
    return (
      <div style={{ background: "#F9FBFF", border: "0.5px solid #D6E4F7", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Prep checklist</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Apply a checklist template to auto-create dated prep tasks (T-30 → T+1).</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {templates.map((t) => (
            <button key={t.id} onClick={() => void apply(t.id)} disabled={applying} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{applying ? "Applying…" : `Apply ${t.name} (${t.item_count})`}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Prep checklist</span>
        <span style={{ fontSize: 11.5, color: MUTED }}>{done}/{tasks.length} · {pct}%</span>
        <div style={{ flex: 1, height: 6, background: "#F1EFE8", borderRadius: 99, overflow: "hidden", maxWidth: 220 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#1D9E75" : BLUE, borderRadius: 99 }} />
        </div>
      </div>
      {phases.map((ph) => (
        <div key={ph} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em", margin: "6px 0 3px" }}>{ph}</div>
          {(byPhase.get(ph) ?? []).map((t) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={t.status === "done"} onChange={(e) => void toggle(t, e.target.checked)} />
              <span style={{ flex: 1, color: t.status === "done" ? MUTED : NAVY, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
              {t.department_name && <span style={{ fontSize: 10.5, color: MUTED }}>{t.department_name}</span>}
              {t.due_date && <span style={{ fontSize: 10.5, color: t.status !== "done" && t.due_date < today ? "#A32D2D" : MUTED }}>{t.due_date}</span>}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

interface LinkedEvent { id: string; title: string; slug: string }
interface RegData { linked: boolean; event: LinkedEvent | null; stats: { registered: number; attended: number; no_show: number; attend_pct: number | null } | null; registered: number; attended: number; attend_pct: number | null }
function RegistrationsPanel({ conferenceId }: { conferenceId: string }) {
  const [data, setData] = useState<RegData | null>(null);
  const [events, setEvents] = useState<LinkedEvent[]>([]);
  const [linking, setLinking] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/meetings/conferences/${conferenceId}/registrations`).then((r) => r.json()).then((d) => setData(d as RegData)).catch(() => {});
  }, [conferenceId]);
  useEffect(() => {
    load();
    fetch("/api/admin/meetings/conferences/events-list").then((r) => r.json()).then((d) => setEvents((d.events ?? []) as LinkedEvent[])).catch(() => {});
  }, [load]);

  const setLink = async (eventId: string | null) => {
    await fetch(`/api/admin/meetings/conferences/${conferenceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: eventId }) }).catch(() => {});
    setLinking(""); load();
  };

  const stat = (label: string, value: number | string, color?: string) => (
    <div style={{ background: "#F9FBFF", borderRadius: 9, padding: "9px 12px", flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? NAVY, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Registrations</span>
        {data?.linked && data.event && <span style={{ fontSize: 10.5, background: "#E1F5EE", color: "#0F6E56", borderRadius: 5, padding: "1px 7px" }}>iCFO Event: {data.event.title}</span>}
        {data?.linked && data.event && <a href={`/events/${data.event.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: BLUE, textDecoration: "none" }}>View event →</a>}
        {data?.linked && <button onClick={() => void setLink(null)} style={{ marginLeft: "auto", fontSize: 11, color: MUTED, background: "transparent", border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>Unlink</button>}
      </div>

      {data?.linked && data.stats ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stat("Registered", data.stats.registered)}
          {stat("Attended", data.stats.attended, "#0F6E56")}
          {stat("No-show", data.stats.no_show, "#A32D2D")}
          {stat("Attendance", data.stats.attend_pct != null ? `${data.stats.attend_pct}%` : "—", BLUE)}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 0 }}>Link this conference to an iCFO Event to pull its registrations from your own registration system.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={linking} onChange={(e) => setLinking(e.target.value)} style={{ fontSize: 12.5, padding: "6px 9px", borderRadius: 8, border: "0.5px solid var(--border)", minWidth: 220 }}>
              <option value="">Select an iCFO Event…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <button onClick={() => linking && void setLink(linking)} disabled={!linking} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Link event</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddSessionForm({ conferenceId, onDone, onCancel }: { conferenceId: string; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/meetings/conferences/${conferenceId}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), speaker: speaker || null, starts_at: starts ? new Date(starts).toISOString() : null, ends_at: ends ? new Date(ends).toISOString() : null, session_url: url || null }),
      });
      if (r.ok) onDone(); else setBusy(false);
    } catch { setBusy(false); }
  };
  const field: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)" };
  return (
    <div style={{ background: "#F9FBFF", border: "0.5px solid #D6E4F7", borderRadius: 10, padding: 12 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session / talk title" autoFocus style={{ ...field, width: "100%", marginBottom: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Speaker" style={field} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Session URL" style={field} />
        <label style={{ fontSize: 10.5, color: MUTED }}>Starts<input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} style={{ ...field, width: "100%", marginTop: 3 }} /></label>
        <label style={{ fontSize: 10.5, color: MUTED }}>Ends<input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} style={{ ...field, width: "100%", marginTop: 3 }} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => void save()} disabled={busy || !title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>{busy ? "Adding…" : "Add session"}</button>
        <button onClick={onCancel} style={{ fontSize: 12, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function fmtRange(start: string, end: string | null): string {
  const s = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (!end || end === start) return s;
  const e = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
