"use client";

import Link from "next/link";
import { useState } from "react";
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

  if (!conference) return <p style={{ fontSize: 13, color: MUTED }}>Conference not found.</p>;

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
      <Link href="/admin/meetings/conferences" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Conferences</Link>
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
