"use client";

import { useCallback, useEffect, useState } from "react";
import type { CeoMeeting } from "@/lib/ceo/meetings";
import type { Goal } from "@/lib/ceo/planning";

const navy = "#0A1A40", royal = "#1A6CE4";
const DAY_OPTS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]];
const inp: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid #E4E8F0", background: "#fff", color: navy, boxSizing: "border-box" };

async function api(url: string, method: string, body?: unknown) {
  try {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: `HTTP ${r.status} ${r.statusText}${text ? ` — ${text.slice(0, 160)}` : ""}` }; }
    return { ok: r.ok, data };
  } catch (e) { return { ok: false, data: { error: e instanceof Error ? e.message : "Network error" } as Record<string, unknown> }; }
}

/* ── Planning: goals CRUD ── */

interface SuggestedGoal { title: string; metric?: string | null; target?: number | null; period?: string | null; rationale?: string | null }

export function PlanningTab() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", metric: "", target: "", current: "", period: "", dueDate: "" });
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedGoal[] | null>(null);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const load = useCallback(async () => { const { ok, data } = await api("/api/ceo/goals", "GET"); if (ok) setGoals((data as { goals: Goal[] }).goals ?? []); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load goals on mount
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setBusy(true);
    const body = { title: draft.title, metric: draft.metric || null, target: draft.target ? Number(draft.target) : null, current: draft.current ? Number(draft.current) : 0, period: draft.period || null, dueDate: draft.dueDate || null };
    const { ok } = await api("/api/ceo/goals", "POST", body);
    setBusy(false);
    if (ok) { setAdding(false); setDraft({ title: "", metric: "", target: "", current: "", period: "", dueDate: "" }); void load(); }
  }
  async function patch(id: string, p: Record<string, unknown>) { await api(`/api/ceo/goals/${id}`, "PATCH", p); void load(); }
  async function del(id: string) { if (!confirm("Delete this goal?")) return; await api(`/api/ceo/goals/${id}`, "DELETE"); void load(); }

  async function suggest() {
    setSuggesting(true); setSuggestMsg(null); setSuggestions(null);
    const { ok, data } = await api("/api/ceo/goals/suggest", "POST", {});
    setSuggesting(false);
    const d = data as { goals?: SuggestedGoal[]; skippedReason?: string; error?: string };
    if (ok && d.goals && d.goals.length > 0) setSuggestions(d.goals);
    else setSuggestMsg(
      d.skippedReason === "claude_not_configured" ? "AI is off — set ANTHROPIC_API_KEY to enable suggestions."
      : d.skippedReason ? "Not enough KPI data yet — run snapshots first, then try again."
      : d.error ?? "No suggestions available right now.");
  }
  async function addSuggested(g: SuggestedGoal) {
    await api("/api/ceo/goals", "POST", { title: g.title, metric: g.metric ?? null, target: g.target ?? null, current: 0, period: g.period ?? null, dueDate: null });
    setSuggestions((cur) => (cur ? cur.filter((x) => x !== g) : cur));
    void load();
  }

  if (!goals) return <p style={{ fontSize: 13, color: "#6B7690" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy }}>Planning · Goals</div>
        <button onClick={suggest} disabled={suggesting} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: royal, background: "#EEF3FC", border: "none", borderRadius: 8, padding: "8px 13px", cursor: suggesting ? "default" : "pointer", opacity: suggesting ? 0.7 : 1 }}>{suggesting ? "Thinking…" : "✦ Suggest goals"}</button>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: navy, border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer" }}>{adding ? "Cancel" : "+ New goal"}</button>
      </div>

      {suggestMsg && <div style={{ fontSize: 12, color: "#D6455D", marginBottom: 10 }}>{suggestMsg}</div>}
      {suggestions && suggestions.length > 0 && (
        <div style={{ background: "#F7FAFF", border: "1px solid #DCE7FA", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: royal }}>AI-suggested goals</div>
            <button onClick={() => setSuggestions(null)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 15, color: "#98A2B3", cursor: "pointer", lineHeight: 1 }} aria-label="Dismiss">✕</button>
          </div>
          {suggestions.map((g, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderTop: i ? "1px solid #E4ECF9" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: navy }}>{g.title}</div>
                <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 2 }}>{[g.metric, g.target != null ? `target ${g.target}` : null, g.period].filter(Boolean).join(" · ")}</div>
                {g.rationale && <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 3, lineHeight: 1.5 }}>{g.rationale}</div>}
              </div>
              <button onClick={() => addSuggested(g)} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background: "#F6F8FB", borderRadius: 10, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <input placeholder="Goal title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inp, gridColumn: "1 / -1" }} />
          <input placeholder="Metric (e.g. MRR)" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} style={inp} />
          <input placeholder="Target" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} inputMode="decimal" style={inp} />
          <input placeholder="Current" value={draft.current} onChange={(e) => setDraft({ ...draft, current: e.target.value })} inputMode="decimal" style={inp} />
          <input placeholder="Period (e.g. Q3)" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} style={inp} />
          <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={inp} />
          <button onClick={add} disabled={busy || !draft.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer" }}>{busy ? "Saving…" : "Save goal"}</button>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
        {goals.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No goals yet.</div>
          : goals.map((g) => {
            const pct = g.target ? Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100))) : 0;
            return (
              <div key={g.id} style={{ padding: "12px 16px", borderTop: "1px solid #F1F4F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.title}</div>
                  {g.period && <span style={{ fontSize: 10.5, color: "#6B7690", background: "#EEF1F7", borderRadius: 99, padding: "2px 8px" }}>{g.period}</span>}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input defaultValue={g.current} onBlur={(e) => { const v = Number(e.target.value); if (v !== g.current) void patch(g.id, { current: v }); }} inputMode="decimal" style={{ ...inp, width: 64, padding: "5px 7px", textAlign: "center" }} />
                    <span style={{ color: "#6B7690" }}>/ {g.target ?? "—"} {g.metric ?? ""}</span>
                    <button onClick={() => del(g.id)} style={{ fontSize: 11.5, color: "#D6455D", background: "#FCE9EC", border: "none", borderRadius: 7, padding: "4px 9px", cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
                <div style={{ height: 6, background: "#EEF1F7", borderRadius: 3, marginTop: 8, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: 6, background: royal }} /></div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ── Settings: notification prefs + meeting schedule ── */

export function SettingsTab({ meetings, onRefreshMeetings }: { meetings: CeoMeeting[]; onRefreshMeetings: () => void }) {
  const [prefs, setPrefs] = useState<{ emailDaily: boolean; emailWeekly: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState<null | "snap" | "brief">(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function runSnapshots() {
    setRunning("snap"); setRunMsg(null);
    const { ok, data } = await api("/api/ceo/snapshots", "POST", {});
    setRunning(null);
    const d = data as { computed?: string[]; skipped?: string[]; error?: string };
    setRunMsg(ok ? `Snapshots updated — ${d.computed?.length ?? 0} KPIs computed, ${d.skipped?.length ?? 0} n/a. Reload to see them.` : (d.error ?? "Failed."));
  }
  async function runBriefing() {
    setRunning("brief"); setRunMsg(null);
    const { ok, data } = await api("/api/ceo/briefing?mode=weekly", "POST", {});
    setRunning(null);
    const d = data as { briefWritten?: boolean; kpiAiWritten?: number; skippedReason?: string; briefError?: string; error?: string };
    setRunMsg(ok
      ? (d.skippedReason === "claude_not_configured"
          ? "Ran, but ANTHROPIC_API_KEY isn't set in the server environment — no AI content generated."
          : d.briefWritten
            ? `Brief generated; ${d.kpiAiWritten ?? 0} KPI analyses written. Reload to see them.`
            : `Brief could not be generated${d.briefError ? ` — ${d.briefError}` : ""}.`)
      : (d.error ?? "Failed."));
  }

  const load = useCallback(async () => { const { ok, data } = await api("/api/ceo/settings", "GET"); if (ok) setPrefs(data as { emailDaily: boolean; emailWeekly: boolean }); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load prefs on mount
  useEffect(() => { void load(); }, [load]);

  async function setPref(p: Partial<{ emailDaily: boolean; emailWeekly: boolean }>) {
    setPrefs((cur) => cur ? { ...cur, ...p } : cur);
    await api("/api/ceo/settings", "PATCH", p);
  }

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy, marginBottom: 10 }}>Data &amp; AI</div>
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={runSnapshots} disabled={running !== null} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: navy, border: "none", borderRadius: 8, padding: "9px 14px", cursor: running ? "default" : "pointer", opacity: running === "snap" ? 0.6 : 1 }}>{running === "snap" ? "Computing…" : "Recompute snapshots"}</button>
            <button onClick={runBriefing} disabled={running !== null} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "9px 14px", cursor: running ? "default" : "pointer", opacity: running === "brief" ? 0.6 : 1 }}>{running === "brief" ? "Generating…" : "Generate AI brief now"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 10, lineHeight: 1.5 }}>Recompute pulls this week&apos;s KPI values from Sales, Marketing &amp; task data. Generate writes the daily/weekly brief and per-KPI coaching (needs an Anthropic API key). Both normally run on the cron — use these to run on demand.</div>
          {runMsg && <div style={{ fontSize: 12, color: /Failed|isn't set|could not|HTTP|error/i.test(runMsg) ? "#D6455D" : "#0E9F6E", marginTop: 10 }}>{runMsg}</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy, marginBottom: 10 }}>Notifications</div>
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          {[["emailWeekly", "Weekly brief email", "Monday's full brief + KPI coaching."], ["emailDaily", "Daily brief email", "A lighter daily brief on watch items."]].map(([key, title, desc], i) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid #F1F4F9" : "none" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div><div style={{ fontSize: 11.5, color: "#6B7690" }}>{desc}</div></div>
              <Toggle on={prefs ? prefs[key as "emailDaily" | "emailWeekly"] : false} onChange={(v) => setPref({ [key]: v })} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy, marginBottom: 10 }}>Meeting schedule</div>
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          {meetings.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No meetings.</div>
            : meetings.map((m, i) => <MeetingRow key={m.key} meeting={m} first={i === 0} onSaved={() => { onRefreshMeetings(); setMsg("Schedule updated."); }} />)}
        </div>
        {msg && <div style={{ fontSize: 11.5, color: "#0E9F6E", marginTop: 8 }}>{msg}</div>}
      </div>
    </div>
  );
}

const CADENCE_OPTS: [string, string][] = [["weekly", "Weekly"], ["biweekly", "Biweekly"], ["monthly", "Monthly"]];

function MeetingRow({ meeting, first, onSaved }: { meeting: CeoMeeting; first: boolean; onSaved: () => void }) {
  const [cadence, setCadence] = useState<string>(meeting.cadence);
  const [day, setDay] = useState(meeting.dayOfWeek);
  const [time, setTime] = useState(meeting.timeLocal.slice(0, 5));
  const [dur, setDur] = useState(meeting.durationMin);
  const [busy, setBusy] = useState(false);
  const dirty = cadence !== meeting.cadence || day !== meeting.dayOfWeek || time !== meeting.timeLocal.slice(0, 5) || dur !== meeting.durationMin;

  async function save() {
    setBusy(true);
    await api(`/api/ceo/meetings/${meeting.key}`, "PATCH", { cadence, dayOfWeek: day, timeLocal: time, durationMin: dur });
    setBusy(false); onSaved();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: first ? "none" : "1px solid #F1F4F9", flexWrap: "wrap" }}>
      <div style={{ minWidth: 150, fontSize: 13, fontWeight: 600 }}>{meeting.name}{meeting.gcalEventId && <span style={{ marginLeft: 6, fontSize: 10, color: "#0E9F6E" }}>· synced</span>}</div>
      <select value={cadence} onChange={(e) => setCadence(e.target.value)} style={inp}>{CADENCE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={inp}>{DAY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inp} />
      <input type="number" value={dur} onChange={(e) => setDur(Number(e.target.value))} style={{ ...inp, width: 72 }} /> <span style={{ fontSize: 11.5, color: "#6B7690" }}>min</span>
      <button onClick={save} disabled={busy || !dirty} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#fff", background: dirty ? royal : "#C9D6EC", border: "none", borderRadius: 8, padding: "7px 13px", cursor: dirty ? "pointer" : "default" }}>{busy ? "Saving…" : "Save"}</button>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: on ? royal : "#CBD5E1", position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}
