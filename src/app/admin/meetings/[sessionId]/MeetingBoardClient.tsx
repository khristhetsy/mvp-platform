"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type FlowTab = "dashboard" | "departments" | "summary" | "plan";
const FLOW_TABS: Array<{ key: FlowTab; label: string }> = [
  { key: "dashboard", label: "1 · Dashboard" },
  { key: "departments", label: "2 · Departments" },
  { key: "summary", label: "3 · Summary & AI" },
  { key: "plan", label: "4 · Plan of Action" },
];

export function MeetingBoardClient({ initial, isAdmin = false }: { initial: Board; isAdmin?: boolean }) {
  const board = initial;
  const [taskRefresh, setTaskRefresh] = useState(0);
  const [tab, setTab] = useState<FlowTab>("dashboard");
  const [deptNames, setDeptNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/meetings/meta").then((r) => r.json()).then((d) => {
      const map: Record<string, string> = {};
      for (const dep of (d.departments ?? []) as Array<{ id: string; name: string }>) map[dep.id] = dep.name;
      setDeptNames(map);
    }).catch(() => {});
  }, []);

  if (!board.session) return <p style={{ fontSize: 13, color: MUTED }}>Meeting session not found.</p>;
  const ready = board.sections.filter((s) => board.entries[s.id]?.status === "ready" || board.entries[s.id]?.status === "presented").length;
  const sessionId = board.session.id;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 2px" }}>{board.session.meeting_name}</h1>
        <div style={{ fontSize: 12.5, color: MUTED }}>
          {new Date(`${board.session.session_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {board.session.started_at ? "Live" : "Scheduled"} · Readiness {ready}/{board.sections.length}
        </div>
        <GoogleMeetBar sessionId={sessionId} meetLink={board.session.meet_link} />
        <MeetingLifecycleControls sessionId={sessionId} status={board.session.status} startedAt={board.session.started_at} isAdmin={isAdmin} />
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--border)", marginBottom: 16, flexWrap: "wrap" }}>
        {FLOW_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "8px 14px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: tab === t.key ? BLUE : MUTED, fontWeight: tab === t.key ? 600 : 400, borderBottom: tab === t.key ? `2px solid ${BLUE}` : "2px solid transparent" }}>{t.label}</button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div>
          <CarryoverPanel sessionId={sessionId} />
          <ReadinessBoard sections={board.sections} entries={board.entries} deptNames={deptNames} />
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
      )}

      {tab === "departments" && <DepartmentsTab sections={board.sections} entries={board.entries} deptNames={deptNames} />}

      {tab === "summary" && <MeetingAiPanel sessionId={sessionId} onTaskCreated={() => setTaskRefresh((n) => n + 1)} />}

      {tab === "plan" && (
        <div>
          <PlanAtRiskWidget />
          <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Strategic objectives and milestones are managed on the Plan of Action board.</div>
            <Link href="/admin/meetings/plan" style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>Open Plan of Action →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadinessBoard({ sections, entries, deptNames }: { sections: Section[]; entries: Record<string, Entry>; deptNames: Record<string, string> }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #F1F4F9", fontSize: 13, fontWeight: 600, color: NAVY }}>Readiness board</div>
      {sections.map((s) => {
        const entry = entries[s.id];
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderTop: "0.5px solid #F6F8FB" }}>
            <span style={{ fontSize: 12.5, color: NAVY, flex: 1 }}>{s.title}</span>
            {s.department_id && deptNames[s.department_id] && <span style={{ fontSize: 10.5, background: "#EEF3FC", color: "#185FA5", borderRadius: 5, padding: "1px 6px" }}>{deptNames[s.department_id]}</span>}
            {s.is_required && <span style={{ fontSize: 9.5, color: MUTED }}>required</span>}
            {pill(entry?.status ?? "not_started")}
          </div>
        );
      })}
    </div>
  );
}

function DepartmentsTab({ sections, entries, deptNames }: { sections: Section[]; entries: Record<string, Entry>; deptNames: Record<string, string> }) {
  const groups = new Map<string, Section[]>();
  for (const s of sections) {
    const key = s.department_id ?? "__general__";
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const keys = [...groups.keys()];
  const [active, setActive] = useState(keys[0] ?? "__general__");
  const label = (k: string) => (k === "__general__" ? "General" : deptNames[k] ?? "Department");
  const activeSections = groups.get(active) ?? [];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {keys.map((k) => (
          <button key={k} onClick={() => setActive(k)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: active === k ? "none" : "0.5px solid var(--border)", background: active === k ? BLUE : "#fff", color: active === k ? "#fff" : NAVY, cursor: "pointer", fontWeight: active === k ? 600 : 400 }}>{label(k)}</button>
        ))}
      </div>
      {active !== "__general__" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Link href={`/admin/meetings/kpi?dept=${active}`} style={{ fontSize: 11.5, fontWeight: 600, color: BLUE, background: "#E6F1FB", borderRadius: 7, padding: "5px 10px", textDecoration: "none" }}>📊 KPI Sheet</Link>
          <span style={{ fontSize: 11.5, color: MUTED, alignSelf: "center" }}>📡 iCapOS Analytics — zero-copy from the {label(active)} Hub</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {activeSections.map((s) => {
          const entry = entries[s.id];
          if (!entry) return null;
          return <SectionCard key={s.id} section={s} entry={entry} />;
        })}
      </div>
    </div>
  );
}

function MeetingLifecycleControls({ sessionId, status, startedAt, isAdmin }: { sessionId: string; status: string; startedAt: string | null; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "start" | "close">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const live = status === "live" || (!!startedAt && status !== "closed");
  const closed = status === "closed" || status === "summarized";

  const run = async (action: "start" | "close") => {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/${action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(typeof d.error === "string" ? d.error : "Action failed."); return; }
      if (action === "start" && typeof d.snapshots === "number") setMsg(`Started · froze ${d.snapshots} KPI snapshot${d.snapshots === 1 ? "" : "s"}`);
      if (action === "close" && typeof d.deferred === "number") setMsg(`Closed · ${d.deferred} section${d.deferred === 1 ? "" : "s"} deferred`);
      router.refresh();
    } catch { setMsg("Action failed."); }
    finally { setBusy(null); }
  };

  const tone = closed ? { bg: "#EEF2FF", c: "#3730A3", l: "Closed" } : live ? { bg: "#E1F5EE", c: "#0F6E56", l: "Live" } : { bg: "#F1EFE8", c: "#5F5E5A", l: "Scheduled" };
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, background: tone.bg, color: tone.c, borderRadius: 6, padding: "3px 9px" }}>{tone.l}</span>
      {isAdmin && !live && !closed && (
        <button onClick={() => void run("start")} disabled={busy !== null} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy === "start" ? "Starting…" : "▶ Start meeting"}</button>
      )}
      {isAdmin && live && !closed && (
        <button onClick={() => void run("close")} disabled={busy !== null} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy === "close" ? "Closing…" : "■ Close meeting"}</button>
      )}
      {msg && <span style={{ fontSize: 11.5, color: MUTED }}>{msg}</span>}
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
