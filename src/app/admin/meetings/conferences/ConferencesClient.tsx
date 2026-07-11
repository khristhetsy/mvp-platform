"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
interface Dept { id: string; name: string }
interface Staff { id: string; name: string }
interface Conference {
  id: string; title: string; kind: string; start_date: string; end_date: string | null;
  location: string | null; department_name: string | null; host_name: string | null; status: string; session_count: number;
}

const KIND_LABEL: Record<string, string> = { conference: "Conference", summit: "Summit", talkshow: "Talk show", webinar: "Webinar" };
const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  draft: { bg: "#F1EFE8", c: "#5F5E5A" }, scheduled: { bg: "#E6F1FB", c: "#185FA5" },
  live: { bg: "#E1F5EE", c: "#0F6E56" }, done: { bg: "#EEF2FF", c: "#3730A3" }, cancelled: { bg: "#FCEBEB", c: "#A32D2D" },
};

export function ConferencesClient({ initial, departments, staff }: { initial: Conference[]; departments: Dept[]; staff: Staff[] }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>Conferences & Events</h1>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Conferences, summits, and talk shows with a session agenda.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>+ New event</button>
      </div>

      {initial.length === 0 ? (
        <p style={{ fontSize: 12.5, color: MUTED }}>No conferences yet. Create one to build its agenda.</p>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1fr 0.7fr 0.6fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: MUTED }}>
            <div>Event</div><div>Kind</div><div>Dates</div><div>Sessions</div><div>Status</div>
          </div>
          {initial.map((c) => {
            const tone = STATUS_TONE[c.status] ?? STATUS_TONE.draft;
            return (
              <Link key={c.id} href={`/admin/meetings/conferences/${c.id}`} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1fr 0.7fr 0.6fr", padding: "10px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: NAVY }}>{c.title}</div>
                  {c.location && <div style={{ fontSize: 10.5, color: MUTED }}>{c.location}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{KIND_LABEL[c.kind] ?? c.kind}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{fmtRange(c.start_date, c.end_date)}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{c.session_count}</div>
                <div><span style={{ fontSize: 10.5, fontWeight: 600, background: tone.bg, color: tone.c, borderRadius: 6, padding: "2px 8px", textTransform: "capitalize" }}>{c.status}</span></div>
              </Link>
            );
          })}
        </div>
      )}

      {showNew && <NewConferenceModal departments={departments} staff={staff} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function fmtRange(start: string, end: string | null): string {
  const s = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!end || end === start) return s;
  const e = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

function NewConferenceModal({ departments, staff, onClose }: { departments: Dept[]; staff: Staff[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("conference");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [dept, setDept] = useState("");
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || !start) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/conferences", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind, start_date: start, end_date: end || null, location: location || null, department_id: dept || null, host_id: host || null }),
      });
      const d = await r.json();
      if (r.ok && d.id) router.push(`/admin/meetings/conferences/${d.id}`);
      else setBusy(false);
    } catch { setBusy(false); }
  };

  const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", marginTop: 4 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New conference" style={{ width: "min(480px, 94vw)", background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 12 }}>New event</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" style={field} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={field}>
            <option value="conference">Conference</option><option value="summit">Summit</option><option value="talkshow">Talk show</option><option value="webinar">Webinar</option>
          </select>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location / URL" style={field} />
          <label style={{ fontSize: 10.5, color: MUTED }}>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={field} /></label>
          <label style={{ fontSize: 10.5, color: MUTED }}>End (optional)<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={field} /></label>
          <select value={dept} onChange={(e) => setDept(e.target.value)} style={field}><option value="">Department…</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={host} onChange={(e) => setHost(e.target.value)} style={field}><option value="">Host…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => void create()} disabled={busy || !title.trim() || !start} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Creating…" : "Create event"}</button>
          <button onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
