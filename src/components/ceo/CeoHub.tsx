"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HubShell, type HubTab } from "@/components/admin/hub/HubShell";
import { status as kpiStatus, compare, formatKpi, deptScore, type KpiStatus, type Period } from "@/lib/ceo/kpi";
import type { CeoPayload, CeoKpi } from "@/lib/ceo/hub-data";
import type { CeoMeeting, CeoSession, CeoOccurrence } from "@/lib/ceo/meetings";
import { MeetingWorkflowCard, MeetingLog } from "@/components/ceo/Meetings";
import { CalendarView } from "@/components/ceo/Calendar";
import { PlanningTab, SettingsTab } from "@/components/ceo/PlanningSettings";

const ST = { g: { c: "#0E9F6E", bg: "#E6F6EC", l: "On target" }, y: { c: "#B7791F", bg: "#FDF3E3", l: "Watch" }, r: { c: "#D6455D", bg: "#FCE9EC", l: "Off track" } };
const DEPT_LABEL: Record<string, string> = { sales: "Sales", marketing: "Marketing", operations: "Investor Relations" };
const P_LABEL: Record<Period, string> = { wk: "Week", mo: "Month", qtr: "Quarter", ytd: "Year" };
const C_LABEL: Record<string, string> = { lw: "last week", lm: "last month", ly: "last year" };
const navy = "#0A1A40", royal = "#1A6CE4";

type Cmp = "lw" | "lm" | "ly";
interface KpiView { na: boolean; runRate: number; display: number; st: KpiStatus; delta: { pct: number; good: boolean } | null }

function computeView(kpi: CeoKpi, period: Period, cmp: Cmp): KpiView {
  const vals = kpi.weeks.map((w) => w.value);
  const wcount = period === "wk" ? 1 : period === "mo" ? 4 : period === "qtr" ? 13 : Math.max(vals.length, 1);
  const window = vals.slice(-wcount);
  if (window.length === 0) return { na: true, runRate: 0, display: 0, st: "r", delta: null };
  const runRate = window.reduce((a, b) => a + b, 0) / window.length;
  const display = kpi.scalesWithPeriod ? window.reduce((a, b) => a + b, 0) : Math.round(runRate * 10) / 10;
  const st = kpiStatus(runRate, kpi);
  const cmpWeeks = cmp === "lw" ? 1 : cmp === "lm" ? 4 : 52;
  const endBase = vals.length - window.length;
  const startBase = endBase - cmpWeeks;
  const baseWindow = startBase >= 0 ? vals.slice(startBase, endBase) : [];
  const baseRun = baseWindow.length ? baseWindow.reduce((a, b) => a + b, 0) / baseWindow.length : null;
  return { na: false, runRate, display, st, delta: compare(runRate, baseRun, kpi.direction) };
}

export function CeoHub({ initial, initialTab }: { initial: CeoPayload; initialTab: string }) {
  const [tab, setTab] = useState(initialTab);
  const [meetings, setMeetings] = useState<CeoMeeting[]>([]);
  const [sessions, setSessions] = useState<CeoSession[]>([]);
  const [occurrences, setOccurrences] = useState<CeoOccurrence[]>([]);
  const loadMeetings = useCallback(async () => {
    try { const r = await fetch("/api/ceo/meetings"); if (r.ok) { const d = await r.json(); setMeetings(d.meetings ?? []); setSessions(d.sessions ?? []); setOccurrences(d.occurrences ?? []); } } catch { /* ignore */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch meetings on mount
  useEffect(() => { void loadMeetings(); }, [loadMeetings]);
  function changeTab(k: string) { setTab(k); try { window.history.replaceState(null, "", `?tab=${k}`); } catch { /* ignore */ } }

  const tabs: HubTab[] = [
    { key: "dash", label: "Dashboard" }, { key: "sales", label: "Sales" }, { key: "marketing", label: "Marketing" },
    { key: "operations", label: "Investor Relations" }, { key: "planning", label: "Planning" }, { key: "calendar", label: "Calendar" }, { key: "log", label: "Meeting Log" }, { key: "settings", label: "Settings" },
  ];

  return (
    <HubShell flat title="CEO Hub" subtitle="iCapOS — your operating cockpit" tabs={tabs} activeTab={tab} onTabChange={changeTab}>
      {tab === "dash" && <Dashboard payload={initial} onJump={changeTab} />}
      {(tab === "sales" || tab === "marketing" || tab === "operations") && (
        <DeptTab dept={tab} kpis={initial.kpis.filter((k) => k.dept === tab)} meetings={meetings.filter((m) => m.dept === tab)} sessions={sessions} onRefresh={loadMeetings} />
      )}
      {tab === "planning" && <PlanningTab />}
      {tab === "calendar" && <CalendarView meetings={meetings} occurrences={occurrences} onRefresh={loadMeetings} />}
      {tab === "log" && <MeetingLog meetings={meetings} sessions={sessions} />}
      {tab === "settings" && <SettingsTab meetings={meetings} onRefreshMeetings={loadMeetings} />}
    </HubShell>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */

function Dashboard({ payload, onJump }: { payload: CeoPayload; onJump: (k: string) => void }) {
  const [phrase, setPhrase] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/ceo/phrase").then((r) => r.ok ? r.json() : null).then((d) => { if (alive && d?.phrase) setPhrase(d.phrase); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const scores = useMemo(() => (["sales", "marketing", "operations"] as const).map((d) => {
    const rows = payload.kpis.filter((k) => k.dept === d).map((k) => computeView(k, "wk", "lw")).filter((v) => !v.na);
    const score = deptScore(rows.map((v) => ({ status: v.st, weight: 1 })));
    return { dept: d, score, count: rows.length };
  }), [payload.kpis]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E4E8F0", borderLeft: `3px solid ${royal}`, borderRadius: 10, padding: "12px 16px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: royal }}>Today</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: navy, fontStyle: "italic" }}>{phrase ?? "Setting the tone for the day…"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {scores.map((s) => (
          <button key={s.dept} onClick={() => onJump(s.dept)} style={{ textAlign: "left", background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B7690", textTransform: "uppercase", letterSpacing: ".05em" }}>{DEPT_LABEL[s.dept]}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: navy, margin: "4px 0 2px" }}>{s.score != null ? `${s.score}/10` : "n/a"}</div>
            <div style={{ fontSize: 11, color: "#6B7690" }}>{s.count} KPI{s.count === 1 ? "" : "s"} scored this week</div>
          </button>
        ))}
      </div>

      <div style={{ background: "linear-gradient(120deg,#0A1A40,#12275C 55%,#1A6CE4 140%)", borderRadius: 12, padding: "16px 18px", color: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "#9DBBF0", marginBottom: 6 }}>AI Chief of Staff — daily brief</div>
        {payload.brief ? <div style={{ fontSize: 14, lineHeight: 1.6 }}>{payload.brief.headline}</div>
          : <div style={{ fontSize: 13, color: "#C7D7F5" }}>No brief yet — the weekly cron generates it. Run snapshots, then the briefing job.</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F4F9", fontSize: 13, fontWeight: 600 }}>Recommendations</div>
          {payload.recommendations.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No open recommendations. The Chief-of-Staff cron surfaces them here.</div>
            : payload.recommendations.map((r) => (
              <div key={r.id} style={{ padding: "11px 16px", borderTop: "1px solid #F1F4F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".4px", padding: "2px 8px", borderRadius: 99, background: r.priority === "high" ? "#FCE9EC" : "#EEF3FC", color: r.priority === "high" ? "#D6455D" : royal, textTransform: "uppercase" }}>{r.priority}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                  {r.hub && <span style={{ marginLeft: "auto", fontSize: 11, color: royal }}>{r.hub}</span>}
                </div>
                {r.detail && <div style={{ fontSize: 12, color: "#6B7690", marginTop: 4, lineHeight: 1.5 }}>{r.detail}</div>}
              </div>
            ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F4F9", fontSize: 13, fontWeight: 600 }}>Goals</div>
          {payload.goals.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No goals yet — add them in Planning.</div>
            : payload.goals.map((g) => {
              const pct = g.target ? Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100))) : 0;
              return (
                <div key={g.id} style={{ padding: "11px 16px", borderTop: "1px solid #F1F4F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600 }}><span>{g.title}</span><span style={{ color: "#6B7690", fontWeight: 500 }}>{g.period ?? ""}</span></div>
                  <div style={{ height: 6, background: "#EEF1F7", borderRadius: 3, marginTop: 6, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: 6, background: royal }} /></div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ── Department KPI tab: scorecard + graphs + drawer ───────────────────────── */

function DeptTab({ dept, kpis, meetings, sessions, onRefresh }: { dept: string; kpis: CeoKpi[]; meetings: CeoMeeting[]; sessions: CeoSession[]; onRefresh: () => void }) {
  const [period, setPeriod] = useState<Period>("wk");
  const [cmp, setCmp] = useState<Cmp>("lw");
  const [view, setView] = useState<"table" | "graphs">("table");
  const [drawer, setDrawer] = useState<CeoKpi | null>(null);

  const rows = kpis.map((k) => ({ kpi: k, v: computeView(k, period, cmp) }));
  const score = deptScore(rows.filter((r) => !r.v.na).map((r) => ({ status: r.v.st, weight: r.kpi.weight })));

  const seg = (opts: [string, string][], val: string, on: (v: string) => void) => (
    <div style={{ display: "inline-flex", background: "#EEF1F7", borderRadius: 8, padding: 2 }}>
      {opts.map(([k, l]) => <button key={k} onClick={() => on(k)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: val === k ? "#fff" : "transparent", color: val === k ? navy : "#6B7690" }}>{l}</button>)}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy }}>{DEPT_LABEL[dept]} <span style={{ fontSize: 13, fontWeight: 500, color: "#6B7690" }}>· score {score != null ? `${score}/10` : "n/a"}</span></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seg([["wk", "Week"], ["mo", "Month"], ["qtr", "Quarter"], ["ytd", "Year"]], period, (v) => setPeriod(v as Period))}
          {seg([["lw", "vs last wk"], ["lm", "vs last mo"], ["ly", "vs last yr"]], cmp, (v) => setCmp(v as Cmp))}
          {seg([["table", "Table"], ["graphs", "Graphs"]], view, (v) => setView(v as "table" | "graphs"))}
        </div>
      </div>

      {period !== "wk" && <div style={{ fontSize: 11, color: "#6B7690", marginBottom: 8 }}>Comparisons use weekly run-rates (avg weekly value), not period totals.</div>}

      {view === "table" ? (
        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1.1fr 1fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "#6B7690" }}>
            <div>KPI</div><div>{P_LABEL[period]}</div><div>Target</div><div>vs {C_LABEL[cmp]}</div><div>Status</div>
          </div>
          {rows.map(({ kpi, v }) => (
            <button key={kpi.key} onClick={() => setDrawer(kpi)} style={{ width: "100%", textAlign: "left", display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1.1fr 1fr", padding: "10px 14px", borderTop: "1px solid #F1F4F9", alignItems: "center", background: "none", border: "none", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#F1F4F9", cursor: "pointer" }}>
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{kpi.label}</div><div style={{ fontSize: 11, color: "#6B7690" }}>{kpi.owner}</div></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: navy }}>{v.na ? <span style={{ color: "#98A2B3" }}>n/a</span> : formatKpi(v.display, kpi.fmt)}</div>
              <div style={{ fontSize: 12, color: "#6B7690" }}>{formatKpi(kpi.target, kpi.fmt)}</div>
              <div style={{ fontSize: 12 }}>{v.delta ? <span style={{ color: v.delta.good ? "#0E9F6E" : "#D6455D", fontWeight: 600 }}>{v.delta.pct > 0 ? "+" : ""}{v.delta.pct}%</span> : <span style={{ color: "#98A2B3" }}>n/a</span>}</div>
              <div>{v.na ? <span style={{ fontSize: 10.5, color: "#98A2B3" }}>—</span> : <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: ST[v.st].bg, color: ST[v.st].c }}>{ST[v.st].l}</span>}</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {rows.map(({ kpi, v }) => (
            <button key={kpi.key} onClick={() => setDrawer(kpi)} style={{ textAlign: "left", background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{kpi.label}</span>
                {!v.na && <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: 99, background: ST[v.st].c }} />}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: navy, margin: "4px 0" }}>{v.na ? <span style={{ fontSize: 13, color: "#98A2B3" }}>n/a</span> : formatKpi(v.display, kpi.fmt)}</div>
              <TrendBars kpi={kpi} st={v.na ? "r" : v.st} />
            </button>
          ))}
        </div>
      )}

      {meetings.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: navy, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>Meetings</div>
          {meetings.map((m) => <MeetingWorkflowCard key={m.key} meeting={m} sessions={sessions} onRefresh={onRefresh} />)}
        </div>
      )}

      {drawer && <KpiDrawer kpi={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function TrendBars({ kpi, st }: { kpi: CeoKpi; st: KpiStatus }) {
  const vals = kpi.weeks.slice(-8).map((w) => w.value);
  if (vals.length === 0) return <div style={{ fontSize: 11, color: "#98A2B3" }}>No trend yet</div>;
  const max = Math.max(...vals, kpi.target) * 1.08 || 1;
  const w = 220, h = 56, bw = 20, gap = 6;
  const ty = h - (kpi.target / max) * (h - 8);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxHeight: 56 }} role="img" aria-label="8-week trend">
      {vals.map((val, i) => { const bh = Math.max((val / max) * (h - 8), 2); return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={3} fill={i === vals.length - 1 ? ST[st].c : "#C9D6EC"} />; })}
      <line x1={0} x2={w} y1={ty} y2={ty} stroke={navy} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} />
    </svg>
  );
}

function KpiDrawer({ kpi, onClose }: { kpi: CeoKpi; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 94vw)", height: "100%", background: "#fff", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div><div style={{ fontSize: 15, fontWeight: 700, color: navy }}>{kpi.label}</div><div style={{ fontSize: 12, color: "#6B7690" }}>{kpi.owner} · target {formatKpi(kpi.target, kpi.fmt)}</div></div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "#6B7690", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: "#F6F8FB", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: royal, marginBottom: 8 }}>Trend</div>
          <TrendBars kpi={kpi} st="g" />
          {kpi.benchmark && <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 8, lineHeight: 1.5 }}><b>Benchmark:</b> {kpi.benchmark}</div>}
        </div>

        <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: royal, marginBottom: 8 }}>AI solutions</div>
          {kpi.ai ? (
            <>
              <div style={{ fontSize: 12.5, color: navy, marginBottom: 8, lineHeight: 1.55 }}>{kpi.ai.diagnosis}</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{kpi.ai.solutions.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </>
          ) : <div style={{ fontSize: 12, color: "#6B7690" }}>No AI analysis yet — generated weekly by the Chief-of-Staff cron.</div>}
        </div>

        {kpi.ai && (
          <div style={{ background: "#EEF3FC", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: royal, marginBottom: 8 }}>Mentorship</div>
            <div style={{ fontSize: 12.5, color: navy, lineHeight: 1.55 }}>{kpi.ai.mentorship}</div>
            <div style={{ fontSize: 12.5, color: "#6B7690", marginTop: 8, fontStyle: "italic" }}>{kpi.ai.coachPrompt}</div>
          </div>
        )}
      </div>
    </div>
  );
}

