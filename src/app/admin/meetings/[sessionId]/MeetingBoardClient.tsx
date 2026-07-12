"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CarryoverPanel, TasksPanel } from "./MeetingTasksPanel";
import { MeetingAiPanel } from "./MeetingAiPanel";
import { MeetingRecapPanel } from "./MeetingRecapPanel";
import { MT, MEETING_WRAP } from "../theme";

const NAVY = MT.text, BLUE = MT.accentText, MUTED = MT.muted;
const CARD = MT.card;

type EntryStatus = "not_started" | "draft" | "ready" | "presented" | "deferred";
interface Section { id: string; position: number; title: string; department_id: string | null; section_kind: string; is_required: boolean; pinned: string | null }
interface Entry { id: string; section_id: string; content: string; status: EntryStatus; locked?: boolean }
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
    <div className="mtg-dark" style={MEETING_WRAP}>
      <style>{`.mtg-dark input,.mtg-dark textarea,.mtg-dark select{background:#0C142E;color:#E8EDF7;border:1px solid rgba(255,255,255,.14);}
.mtg-dark input::placeholder,.mtg-dark textarea::placeholder{color:#5E6E93;}
.mtg-dark input[type=checkbox]{accent-color:#2E6BFF;}
.mtg-dark a{color:#8FB4FF;}`}</style>
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

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid rgba(255,255,255,.10)", marginBottom: 16, flexWrap: "wrap" }}>
        {FLOW_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "8px 14px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: tab === t.key ? BLUE : MUTED, fontWeight: tab === t.key ? 600 : 400, borderBottom: tab === t.key ? `2px solid ${BLUE}` : "2px solid transparent" }}>{t.label}</button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div>
          <DashboardKpiCards />
          <CarryoverPanel sessionId={sessionId} />
          <ReadinessBoard sections={board.sections} entries={board.entries} deptNames={deptNames} />
          <TasksPanel sessionId={sessionId} isAdmin={isAdmin} refreshToken={taskRefresh} />
          {board.attendees.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Attendance</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {board.attendees.map((a) => <span key={a.user_id} style={{ fontSize: 12, background: MT.panel, borderRadius: 8, padding: "4px 10px" }}>{a.name} · {a.status}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "departments" && <DepartmentsTab sessionId={sessionId} sections={board.sections} entries={board.entries} deptNames={deptNames} />}

      {tab === "summary" && (
        <div>
          <MeetingAiPanel sessionId={sessionId} onTaskCreated={() => setTaskRefresh((n) => n + 1)} />
          <MeetingRecapPanel sessionId={sessionId} isAdmin={isAdmin} onTaskCreated={() => setTaskRefresh((n) => n + 1)} />
        </div>
      )}

      {tab === "plan" && (
        <div>
          <PlanAtRiskWidget />
          <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Strategic objectives and milestones are managed on the Plan of Action board.</div>
            <Link href="/admin/meetings/plan" style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>Open Plan of Action →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface KpiRollupRow { kpi_id: string; label: string; actual: number; goal: number; pct: number | null }
function DashboardKpiCards() {
  const [rows, setRows] = useState<KpiRollupRow[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/meetings/kpi/rollup?period=weekly").then((r) => r.json()).then((d) => { if (alive) setRows((d.rows ?? []) as KpiRollupRow[]); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (rows.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
      {rows.slice(0, 4).map((r) => {
        const good = r.pct == null ? MT.textSoft : r.pct >= 100 ? "#7DF0AE" : r.pct >= 70 ? MT.accentText : "#FFB37F";
        return (
          <div key={r.kpi_id} style={{ background: MT.card, border: `1px solid ${MT.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MT.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: MT.text, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{r.actual}<span style={{ fontSize: 12, color: MT.muted, fontWeight: 400 }}> / {r.goal}</span></div>
            <div style={{ fontSize: 11, color: good, marginTop: 2 }}>{r.pct != null ? `${r.pct}% of goal` : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

interface HubAnalytics { available: boolean; source: string; hubHref: string | null; metrics: Array<{ label: string; value: string; delta?: string }> }
function HubAnalyticsPanel({ departmentId }: { departmentId: string }) {
  const [data, setData] = useState<HubAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/meetings/analytics/${departmentId}`).then((r) => r.json()).then((d) => { if (alive) { setData(d.analytics ?? null); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [departmentId]);

  if (loading) return <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Loading 📡 analytics…</div>;
  if (!data || !data.available) return <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>📡 No linked Hub analytics for this department.</div>;
  return (
    <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: MUTED }}>📡 {data.source}</span>
        {data.hubHref && <Link href={data.hubHref} style={{ marginLeft: "auto", fontSize: 11, color: BLUE, textDecoration: "none" }}>Open Hub →</Link>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {data.metrics.map((m, i) => (
          <div key={i} style={{ background: MT.panel, borderRadius: 9, padding: "9px 11px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{m.label}</div>
            {m.delta && <div style={{ fontSize: 10, color: "#6B7690", marginTop: 1 }}>{m.delta}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessBoard({ sections, entries, deptNames }: { sections: Section[]; entries: Record<string, Entry>; deptNames: Record<string, string> }) {
  return (
    <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,.06)", fontSize: 13, fontWeight: 600, color: NAVY }}>Readiness board</div>
      {sections.map((s) => {
        const entry = entries[s.id];
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderTop: "0.5px solid #F6F8FB" }}>
            <span style={{ fontSize: 12.5, color: NAVY, flex: 1 }}>{s.title}</span>
            {s.department_id && deptNames[s.department_id] && <span style={{ fontSize: 10.5, background: MT.chip, color: "#185FA5", borderRadius: 5, padding: "1px 6px" }}>{deptNames[s.department_id]}</span>}
            {s.is_required && <span style={{ fontSize: 9.5, color: MUTED }}>required</span>}
            {pill(entry?.status ?? "not_started")}
          </div>
        );
      })}
    </div>
  );
}

function DepartmentsTab({ sessionId, sections, entries, deptNames }: { sessionId: string; sections: Section[]; entries: Record<string, Entry>; deptNames: Record<string, string> }) {
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
          <button key={k} onClick={() => setActive(k)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: active === k ? "none" : "0.5px solid rgba(255,255,255,.10)", background: active === k ? BLUE : "#fff", color: active === k ? "#fff" : NAVY, cursor: "pointer", fontWeight: active === k ? 600 : 400 }}>{label(k)}</button>
        ))}
      </div>
      {active !== "__general__" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Link href={`/admin/meetings/kpi?dept=${active}`} style={{ fontSize: 11.5, fontWeight: 600, color: BLUE, background: MT.chip, borderRadius: 7, padding: "5px 10px", textDecoration: "none" }}>📊 KPI Sheet</Link>
          </div>
          <HubAnalyticsPanel key={active} departmentId={active} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {activeSections.map((s) => {
          const entry = entries[s.id];
          if (!entry) return null;
          return <SectionCard key={s.id} sessionId={sessionId} section={s} entry={entry} />;
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
    <div style={{ background: "#2A1414", border: "0.5px solid #5C2323", borderRadius: 12, padding: 14, marginBottom: 14 }}>
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
        <button onClick={() => void push()} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: MT.chip, border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy ? "Adding…" : "Add Google Meet"}</button>
      )}
      {link && <button onClick={() => void push()} disabled={busy} title="Re-sync to Google" style={{ fontSize: 11.5, color: MUTED, background: "transparent", border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>↻ Sync</button>}
      {err && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{err}</span>}
    </div>
  );
}

function SectionCard({ sessionId, section, entry }: { sessionId: string; section: Section; entry: Entry }) {
  const [content, setContent] = useState(entry.content);
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; content: string; edited_at: string }> | null>(null);
  const [ai, setAi] = useState<null | "draft" | "polish" | "points">(null);

  const save = useCallback(async (patch: { content?: string; status?: EntryStatus }) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/meetings/entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (r.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally { setSaving(false); }
  }, [entry.id]);

  // AI assist writes into the textarea draft buffer only; a human still Saves it.
  const assist = async (mode: "draft" | "polish" | "points") => {
    setAi(mode);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/journal-ai`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, section_id: section.id, text: mode === "polish" ? content : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return;
      if (mode === "points" && Array.isArray(d.points)) {
        const bullets = d.points.map((p: string) => `• ${p}`).join("\n");
        setContent((c) => (c.trim() ? `${c}\n${bullets}` : bullets));
      } else if (typeof d.text === "string") {
        setContent(d.text);
      }
    } finally { setAi(null); }
  };

  const setStatusAndSave = (s: EntryStatus) => { setStatus(s); void save({ status: s, content }); };
  const loadVersions = async () => {
    if (versions) { setVersions(null); return; }
    const d = await fetch(`/api/admin/meetings/entries/${entry.id}`).then((r) => r.json()).catch(() => ({ versions: [] }));
    setVersions(d.versions ?? []);
  };

  const btn = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 600, color, background: bg, border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer" });
  const aiBtn: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#185FA5", background: MT.chip, border: "0.5px solid #C7DCF5", borderRadius: 6, padding: "3px 9px", cursor: "pointer" };

  if (entry.locked) {
    return (
      <div style={{ background: "#0A1128", border: "0.5px dashed #D8D4C8", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{section.title}</span>
          {pill(status)}
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: MUTED }}>🔒 Locked until the meeting starts</span>
        </div>
        <p style={{ fontSize: 12, color: MUTED, margin: "8px 0 0" }}>This department&apos;s prep is private until the meeting is started.</p>
      </div>
    );
  }

  return (
    <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{section.title}</span>
        {section.pinned && <span style={{ fontSize: 9, background: MT.chip, color: "#185FA5", borderRadius: 4, padding: "1px 5px" }}>{section.pinned === "first" ? "PINNED TOP" : "PINNED END"}</span>}
        {pill(status)}
        <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>{saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#185FA5" }}>✦ AI</span>
        <button onClick={() => void assist("draft")} disabled={ai !== null} style={aiBtn}>{ai === "draft" ? "Drafting…" : "Draft"}</button>
        <button onClick={() => void assist("polish")} disabled={ai !== null || !content.trim()} style={aiBtn}>{ai === "polish" ? "Polishing…" : "Polish"}</button>
        <button onClick={() => void assist("points")} disabled={ai !== null} style={aiBtn}>{ai === "points" ? "Thinking…" : "Talking points"}</button>
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} onBlur={() => { if (content !== entry.content) void save({ content }); }}
        rows={4} placeholder={`${section.title} — journal / prep notes`} style={{ width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,.10)", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => void save({ content })} style={btn("#F1EFE8", NAVY)}>Save</button>
        <button onClick={() => setStatusAndSave("draft")} style={btn("#FAEEDA", "#854F0B")}>Mark draft</button>
        <button onClick={() => setStatusAndSave("ready")} style={btn("#E1F5EE", "#0F6E56")}>Mark ready</button>
        <button onClick={() => void loadVersions()} style={{ ...btn("transparent", MUTED), border: "0.5px solid rgba(255,255,255,.10)" }}>{versions ? "Hide history" : "History"}</button>
      </div>
      {versions && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid rgba(255,255,255,.06)", paddingTop: 8 }}>
          {versions.length === 0 ? <p style={{ fontSize: 11.5, color: MUTED }}>No prior versions.</p> : versions.map((v) => (
            <div key={v.id} style={{ fontSize: 11.5, padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,.06)" }}>
              <span style={{ color: MUTED }}>{new Date(v.edited_at).toLocaleString()}</span>
              <div style={{ color: NAVY, whiteSpace: "pre-wrap" }}>{v.content.slice(0, 240)}{v.content.length > 240 ? "…" : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
