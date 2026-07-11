"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CarryoverPanel, TasksPanel } from "./MeetingTasksPanel";
import { MeetingAiPanel } from "./MeetingAiPanel";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";

type EntryStatus = "not_started" | "draft" | "ready" | "presented" | "deferred";
interface Section { id: string; position: number; title: string; department_id: string | null; section_kind: string; is_required: boolean; pinned: string | null }
interface Entry { id: string; section_id: string; content: string; status: EntryStatus }
interface Attendee { user_id: string; name: string; status: string }
interface Board { session: { id: string; session_date: string; started_at: string | null; status: string; meeting_name: string; meet_link: string | null } | null; sections: Section[]; entries: Record<string, Entry>; attendees: Attendee[] }

const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  not_started: { bg: "#F1EFE8", c: "#5F5E5A" }, draft: { bg: "#FAEEDA", c: "#854F0B" },
  ready: { bg: "#E1F5EE", c: "#0F6E56" }, presented: { bg: "#E6F1FB", c: "#0C447C" }, deferred: { bg: "#FCEBEB", c: "#A32D2D" },
};
function pill(s: string) {
  const t = STATUS_TONE[s] ?? STATUS_TONE.not_started;
  return <span style={{ fontSize: 10.5, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 6, padding: "2px 8px", textTransform: "capitalize" }}>{s.replace("_", " ")}</span>;
}

export function MeetingBoardClient({ initial, isAdmin = false }: { initial: Board; isAdmin?: boolean }) {
  const board = initial;
  const [taskRefresh, setTaskRefresh] = useState(0);
  if (!board.session) return <p style={{ fontSize: 13, color: MUTED }}>Meeting session not found.</p>;
  const ready = board.sections.filter((s) => board.entries[s.id]?.status === "ready" || board.entries[s.id]?.status === "presented").length;
  const sessionId = board.session.id;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 2px" }}>{board.session.meeting_name}</h1>
        <div style={{ fontSize: 12.5, color: MUTED }}>
          {new Date(`${board.session.session_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {board.session.started_at ? "Live" : "Scheduled"} · Readiness {ready}/{board.sections.length}
        </div>
        <GoogleMeetBar sessionId={sessionId} meetLink={board.session.meet_link} />
      </div>

      <CarryoverPanel sessionId={sessionId} />

      <PlanAtRiskWidget />

      <MeetingAiPanel sessionId={sessionId} onTaskCreated={() => setTaskRefresh((n) => n + 1)} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {board.sections.map((s) => {
          const entry = board.entries[s.id];
          if (!entry) return null;
          return <SectionCard key={s.id} section={s} entry={entry} />;
        })}
      </div>

      <TasksPanel sessionId={sessionId} isAdmin={isAdmin} refreshToken={taskRefresh} />

      {board.attendees.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Attendance</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {board.attendees.map((a) => <span key={a.user_id} style={{ fontSize: 12, background: "#F6F8FB", borderRadius: 8, padding: "4px 10px" }}>{a.name} · {a.status}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlanObj { id: string; title: string; department_name: string | null; status: string; progress: number }
function PlanAtRiskWidget() {
  const [items, setItems] = useState<PlanObj[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/meetings/plan").then((r) => r.json()).then((d) => {
      if (!alive) return;
      const risky = ((d.objectives ?? []) as PlanObj[]).filter((o) => o.status === "at_risk" || o.status === "off_track");
      setItems(risky);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (items.length === 0) return null;
  return (
    <div style={{ background: "#FDF3F2", border: "0.5px solid #F0B4AE", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#A32D2D" }}>Plan of Action · {items.length} off track</span>
        <Link href="/admin/meetings/plan" style={{ marginLeft: "auto", fontSize: 11.5, color: BLUE, textDecoration: "none" }}>Review plan →</Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.slice(0, 8).map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: o.status === "off_track" ? "#D2534E" : "#EF9F27" }} />
            <span style={{ color: NAVY, flex: 1 }}>{o.title}</span>
            {o.department_name && <span style={{ fontSize: 10.5, color: MUTED }}>{o.department_name}</span>}
            <span style={{ fontSize: 10.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{o.progress}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleMeetBar({ sessionId, meetLink }: { sessionId: string; meetLink: string | null }) {
  const [link, setLink] = useState(meetLink);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const push = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/gcal`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setErr(typeof d.error === "string" ? d.error : "Failed to push to Google."); return; }
      setLink(d.meetUrl ?? null);
    } catch { setErr("Failed to push to Google."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#185FA5", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>▷ Join Google Meet</a>
      ) : (
        <button onClick={() => void push()} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy ? "Adding…" : "Add Google Meet"}</button>
      )}
      {link && <button onClick={() => void push()} disabled={busy} title="Re-sync to Google" style={{ fontSize: 11.5, color: MUTED, background: "transparent", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>↻ Sync</button>}
      {err && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{err}</span>}
    </div>
  );
}

function SectionCard({ section, entry }: { section: Section; entry: Entry }) {
  const [content, setContent] = useState(entry.content);
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; content: string; edited_at: string }> | null>(null);

  const save = useCallback(async (patch: { content?: string; status?: EntryStatus }) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/meetings/entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (r.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally { setSaving(false); }
  }, [entry.id]);

  const setStatusAndSave = (s: EntryStatus) => { setStatus(s); void save({ status: s, content }); };
  const loadVersions = async () => {
    if (versions) { setVersions(null); return; }
    const d = await fetch(`/api/admin/meetings/entries/${entry.id}`).then((r) => r.json()).catch(() => ({ versions: [] }));
    setVersions(d.versions ?? []);
  };

  const btn = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 600, color, background: bg, border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer" });

  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{section.title}</span>
        {section.pinned && <span style={{ fontSize: 9, background: "#EEF3FC", color: "#185FA5", borderRadius: 4, padding: "1px 5px" }}>{section.pinned === "first" ? "PINNED TOP" : "PINNED END"}</span>}
        {pill(status)}
        <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>{saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : ""}</span>
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} onBlur={() => { if (content !== entry.content) void save({ content }); }}
        rows={4} placeholder={`${section.title} — journal / prep notes`} style={{ width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => void save({ content })} style={btn("#F1EFE8", NAVY)}>Save</button>
        <button onClick={() => setStatusAndSave("draft")} style={btn("#FAEEDA", "#854F0B")}>Mark draft</button>
        <button onClick={() => setStatusAndSave("ready")} style={btn("#E1F5EE", "#0F6E56")}>Mark ready</button>
        <button onClick={() => void loadVersions()} style={{ ...btn("transparent", MUTED), border: "0.5px solid var(--border)" }}>{versions ? "Hide history" : "History"}</button>
      </div>
      {versions && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid #F1F4F9", paddingTop: 8 }}>
          {versions.length === 0 ? <p style={{ fontSize: 11.5, color: MUTED }}>No prior versions.</p> : versions.map((v) => (
            <div key={v.id} style={{ fontSize: 11.5, padding: "4px 0", borderBottom: "0.5px solid #F1F4F9" }}>
              <span style={{ color: MUTED }}>{new Date(v.edited_at).toLocaleString()}</span>
              <div style={{ color: NAVY, whiteSpace: "pre-wrap" }}>{v.content.slice(0, 240)}{v.content.length > 240 ? "…" : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
