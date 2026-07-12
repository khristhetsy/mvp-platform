"use client";

// Team meeting dashboard with three switchable layouts: A command center,
// B readiness-first, C agenda timeline. Same data, different density. The chosen
// view persists in localStorage.
import { useEffect, useState } from "react";
import Link from "next/link";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
type Status = "ready" | "draft" | "none";

export interface DashboardPayload {
  next: { id: string; name: string; date: string; ready: number; total: number } | null;
  openTasks: number;
  atRiskObjectives: number;
  upcomingEvents: number;
  agenda: Array<{ label: string; dept: string | null; status: Status }>;
  deptReadiness: Array<{ name: string; pct: number; status: Status }>;
}

type View = "A" | "B" | "C";
const LS_KEY = "icapos.meetingDash.view";
const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "14px 16px" };
const STATUS_TONE: Record<Status, { bg: string; c: string; label: string }> = {
  ready: { bg: "#E1F5EE", c: "#0F6E56", label: "Ready" },
  draft: { bg: "#FAEEDA", c: "#854F0B", label: "Draft" },
  none: { bg: "#F1EFE8", c: "#5F5E5A", label: "No entry" },
};
const DOT: Record<Status, string> = { ready: "#1D9E75", draft: "#EF9F27", none: "#B4B2A9" };

function fmtDate(d: string) { return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

export function MeetingsDashboardClient({ payload }: { payload: DashboardPayload }) {
  const [view, setView] = useState<View>("A");
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY) as View | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v) setView(v);
    } catch { /* ignore */ }
  }, []);
  const pick = (v: View) => { setView(v); try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ } };

  const n = payload.next;
  const readyPct = n && n.total > 0 ? Math.round((n.ready / n.total) * 100) : 0;

  const seg = (v: View, label: string) => (
    <button onClick={() => pick(v)} style={{ fontSize: 12, padding: "6px 12px", background: view === v ? BLUE : "transparent", color: view === v ? "#fff" : MUTED, border: "none", cursor: "pointer" }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
        {seg("A", "Command center")}{seg("B", "Readiness")}{seg("C", "Agenda")}
      </div>

      {!n ? (
        <div style={{ ...card }}><p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>No upcoming meeting scheduled. <Link href="/admin/meetings" style={{ color: BLUE, textDecoration: "none" }}>Create one →</Link></p></div>
      ) : view === "A" ? (
        <ViewA payload={payload} readyPct={readyPct} />
      ) : view === "B" ? (
        <ViewB payload={payload} readyPct={readyPct} />
      ) : (
        <ViewC payload={payload} readyPct={readyPct} />
      )}
    </div>
  );
}

function MetricCards({ payload }: { payload: DashboardPayload }) {
  const items = [
    { label: "Open action items", value: payload.openTasks, tone: payload.openTasks > 0 ? "#854F0B" : NAVY, href: "/admin/meetings/plan" },
    { label: "Objectives off track", value: payload.atRiskObjectives, tone: payload.atRiskObjectives > 0 ? "#A32D2D" : NAVY, href: "/admin/meetings/plan" },
    { label: "Upcoming events", value: payload.upcomingEvents, tone: NAVY, href: "/admin/meetings/conferences" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map((m) => (
        <Link key={m.label} href={m.href} style={{ background: "#F6F8FB", borderRadius: 8, padding: "10px 12px", textDecoration: "none", display: "block" }}>
          <div style={{ fontSize: 12, color: MUTED }}>{m.label}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: m.tone, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
        </Link>
      ))}
    </div>
  );
}

function ReadinessBar({ name, date, ready, total, pct }: { name: string; date: string; ready: number; total: number; pct: number }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>Next meeting <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}>· {name} · {fmtDate(date)}</span></div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{ready} / {total}</span>
        <span style={{ fontSize: 12.5, color: MUTED }}>sections ready ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#1D9E75" : pct >= 40 ? BLUE : "#EF9F27", borderRadius: 99 }} />
      </div>
    </>
  );
}

function ViewA({ payload, readyPct }: { payload: DashboardPayload; readyPct: number }) {
  const n = payload.next!;
  const notReady = payload.agenda.filter((a) => a.status !== "ready");
  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
        <Link href={`/admin/meetings/${n.id}`} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: "#E6F1FB", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>Open board →</Link>
      </div>
      <ReadinessBar name={n.name} date={n.date} ready={n.ready} total={n.total} pct={readyPct} />
      <div style={{ margin: "14px 0" }}><MetricCards payload={payload} /></div>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, marginBottom: 8 }}>Not ready yet</div>
        {notReady.length === 0 ? <div style={{ fontSize: 12.5, color: "#0F6E56" }}>All sections are ready.</div> : notReady.map((a, i) => (
          <div key={i} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>{a.label}</span><span style={{ color: MUTED }}>{STATUS_TONE[a.status].label}</span></div>
        ))}
      </div>
    </div>
  );
}

function ViewB({ payload, readyPct }: { payload: DashboardPayload; readyPct: number }) {
  const n = payload.next!;
  const circ = 2 * Math.PI * 48;
  const dash = Math.round((readyPct / 100) * circ);
  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", width: 104, height: 104, flex: "0 0 auto" }}>
          <svg viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" strokeWidth="13" />
            <circle cx="60" cy="60" r="48" fill="none" stroke={BLUE} strokeWidth="13" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{readyPct}%</div><div style={{ fontSize: 10.5, color: MUTED }}>ready</div>
          </div>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{n.name} · {fmtDate(n.date)}</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{n.ready} of {n.total} sections ready</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, background: "#FCEBEB", color: "#A32D2D", borderRadius: 20, padding: "2px 9px" }}>{payload.openTasks} open items</span>
            <span style={{ fontSize: 11, background: "#FAEEDA", color: "#854F0B", borderRadius: 20, padding: "2px 9px" }}>{payload.atRiskObjectives} off track</span>
            <span style={{ fontSize: 11, background: "#F1EFE8", color: "#5F5E5A", borderRadius: 20, padding: "2px 9px" }}>{payload.upcomingEvents} events</span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, marginBottom: 8 }}>Department readiness</div>
        {payload.deptReadiness.length === 0 ? <div style={{ fontSize: 12.5, color: MUTED }}>No department sections yet.</div> : payload.deptReadiness.map((d) => {
          const t = STATUS_TONE[d.status];
          return (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
              <span style={{ fontSize: 12.5, width: 130, flex: "0 0 auto" }}>{d.name}</span>
              <div style={{ flex: 1, height: 6, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${d.pct}%`, background: BLUE, borderRadius: 99 }} /></div>
              <span style={{ fontSize: 10.5, flex: "0 0 auto", background: t.bg, color: t.c, borderRadius: 20, padding: "2px 8px" }}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewC({ payload, readyPct }: { payload: DashboardPayload; readyPct: number }) {
  const n = payload.next!;
  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{n.name} agenda <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}>· {fmtDate(n.date)} · {n.ready}/{n.total} ready ({readyPct}%)</span></span>
        <Link href={`/admin/meetings/${n.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>Open board →</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
        <div>
          {payload.agenda.length === 0 ? <div style={{ fontSize: 12.5, color: MUTED }}>No agenda sections.</div> : payload.agenda.map((a, i) => {
            const last = i === payload.agenda.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: DOT[a.status], marginTop: 3 }} />
                  {!last && <span style={{ width: 2, flex: 1, minHeight: 16, background: "var(--border)" }} />}
                </div>
                <div style={{ paddingBottom: last ? 0 : 10, fontSize: 12.5 }}>{a.label} <span style={{ color: MUTED, fontSize: 11 }}>· {a.dept ? `${a.dept} · ` : ""}{STATUS_TONE[a.status].label}</span></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MetricCards payload={payload} />
        </div>
      </div>
    </div>
  );
}
