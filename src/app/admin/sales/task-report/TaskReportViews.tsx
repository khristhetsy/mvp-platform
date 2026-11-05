// Server components for the Task report: view switcher, super admin dashboard, personal summary.
// Target: src/app/admin/sales/task-report/TaskReportViews.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { fmtPct, fmtPct1, pct, type TaskSummary } from "@/lib/task-report/metrics";

const BASE = "/admin/sales/task-report";
const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 };
const hint: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 12 };
const h3: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: "0 0 3px" };

export type View = "dashboard" | "mine" | "tasks";

export function TaskReportNav({ view, isSuper }: { view: View; isSuper: boolean }) {
  const items: Array<{ v: View; label: string }> = [
    ...(isSuper ? [{ v: "dashboard" as View, label: "Dashboard" }] : []),
    { v: "mine", label: "My task summary" },
    { v: "tasks", label: "Tasks" },
  ];
  return (
    <div style={{ display: "inline-flex", background: "#EEF2FA", borderRadius: 8, padding: 3, marginBottom: 14 }}>
      {items.map((i) => (
        <Link key={i.v} href={`${BASE}?view=${i.v}`} aria-current={view === i.v ? "page" : undefined}
          style={{ display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 16px", borderRadius: 6, fontSize: 13, textDecoration: "none", background: view === i.v ? "#2E78F5" : "transparent", color: view === i.v ? "#fff" : "#3A4659", fontWeight: view === i.v ? 600 : 400 }}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, href, late }: { label: string; value: number; sub: string; href: string; late?: boolean }) {
  return (
    <Link href={href} style={{ display: "block", textDecoration: "none", color: "inherit", border: `0.5px solid ${late ? "#E7A29B" : "#e2e6ed"}`, background: "#fff", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: late ? "#B02A37" : "var(--foreground)" }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>
      <span style={{ display: "block", fontSize: 11.5, color: "#4338CA", fontWeight: 600, marginTop: 8 }}>View tasks →</span>
    </Link>
  );
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--muted-foreground)", flexWrap: "wrap", marginBottom: 8 }}>
      {items.map(([c, l]) => <span key={l}><i style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, marginRight: 4, background: c, verticalAlign: -1 }} />{l}</span>)}
    </div>
  );
}

function Segments({ parts, total, height = 20 }: { parts: Array<{ n: number; color: string }>; total: number; height?: number }) {
  return (
    <div style={{ display: "flex", height, borderRadius: 5, overflow: "hidden", background: "#EEF1F6" }}>
      {parts.map((p, i) => <span key={i} style={{ width: `${pct(p.n, total)}%`, background: p.color }} />)}
    </div>
  );
}

const BLUE = "#2E78F5", RED = "#B02A37", GREY = "#9DB2D6", GREEN = "#28A745";

function Row3({ left, mid, right }: { left: ReactNode; mid: ReactNode; right: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "130px minmax(0,1fr) 190px", gap: 12, alignItems: "center", padding: "7px 6px" }}><span style={{ fontWeight: 600, fontSize: 12.5 }}>{left}</span>{mid}<span style={{ fontSize: 12, color: "#4A5568", textAlign: "right" }}>{right}</span></div>;
}

export function TaskReportDashboard({ s, today }: { s: TaskSummary; today: string }) {
  const maxPerson = Math.max(1, ...s.people.map((p) => p.total));
  const maxWeek = Math.max(1, ...s.weeks.flatMap((w) => [w.created, w.completed]));
  const maxCreator = Math.max(1, ...s.creators.map((c) => c.total));
  const ag = s.aging;
  const agTotal = Math.max(1, ag.over30 + ag.under30 + ag.today + ag.next7 + ag.later);
  const q = (extra: string) => `${BASE}?view=tasks&${extra}`;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>Task dashboard</h2>
        <span style={{ fontSize: 11.5, color: "#4A5568", background: "#E9F6EE", border: "1px solid #BFE3CB", borderRadius: 6, padding: "5px 9px" }}>Live counts, {today}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Total tasks" value={s.total} sub="Sales, IR, General, Admin" href={q("filter=none&scope=all")} />
        <Kpi label="Open" value={s.open} sub={`${fmtPct(s.open, s.total)} of all tasks`} href={q("filter=open")} />
        <Kpi label="Overdue" value={s.overdue} sub={`${fmtPct(s.overdue, s.open)} of open tasks`} href={q("filter=overdue")} late />
        <Kpi label="Unassigned" value={s.unassigned} sub={`${s.unassignedOpen.toLocaleString()} of them are open`} href={q("filter=unassigned")} />
        <Kpi label="Done" value={s.done} sub={`${fmtPct(s.done, s.total)} of all tasks`} href={q("filter=done")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: 14, marginBottom: 14 }}>
        <section style={card}>
          <h3 style={h3}>Efficiency ratio</h3>
          <div style={hint}>Share of all tasks that are done.</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: "#1F4FBF", lineHeight: 1 }}>{fmtPct1(s.done, s.total)}</div>
          <div style={{ fontSize: 12, color: "#4A5568", marginTop: 6 }}>{s.done.toLocaleString()} done out of {s.total.toLocaleString()} tasks</div>
          <div style={{ fontSize: 12, background: "#F1F5FD", borderRadius: 8, padding: "8px 10px", color: "#3A4659", marginTop: 10 }}>
            Efficiency ratio = done tasks ÷ total tasks. Open and overdue tasks count against it. Completed ÷ created in the last 8 weeks: {s.efficiency.completed8} of {s.efficiency.created8} ({fmtPct1(s.efficiency.completed8, s.efficiency.created8)}).
          </div>
        </section>
        <section style={card}>
          <h3 style={h3}>Efficiency ratio by person and by source</h3>
          <div style={hint}>Red bar means under 10%.</div>
          {s.efficiency.byPerson.map((p) => (
            <Row3 key={p.name} left={p.name} right={`${p.done} of ${p.total} (${fmtPct1(p.done, p.total)})`}
              mid={<div style={{ height: 14, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${Math.max(p.ratio, 0.8)}%`, background: p.ratio < 10 ? RED : GREEN }} /></div>} />
          ))}
          <div style={{ borderTop: "1px solid #EEF1F6", margin: "8px 0" }} />
          {s.efficiency.bySource.map((x) => (
            <Row3 key={x.source} left={x.label} right={`${x.done} of ${x.total} (${fmtPct1(x.done, x.total)})`}
              mid={<div style={{ height: 14, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${Math.max(x.ratio, 0.8)}%`, background: x.ratio < 10 ? RED : GREEN }} /></div>} />
          ))}
        </section>
      </div>

      <section style={{ ...card, marginBottom: 14 }}>
        <h3 style={h3}>Areas for improvement</h3>
        <div style={hint}>Every figure comes from the task data as of {today}.</div>
        {s.improvements.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Nothing to flag right now.</p>}
        {s.improvements.map((imp, i) => (
          <div key={imp.title} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 170px", gap: 12, padding: "12px 0", borderTop: i ? "1px solid #EEF1F6" : "none", alignItems: "start" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#EAF1FF", color: "#1F4FBF", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <div>
              <b style={{ display: "block", fontSize: 13.5, marginBottom: 2 }}>{imp.title}</b>
              <div style={{ fontSize: 12.5, color: "#4A5568" }}>{imp.evidence}</div>
              <div style={{ fontSize: 12.5, color: "#4B2A6E", marginTop: 4 }}>Suggested action: {imp.action}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 22, fontWeight: 700, color: RED }}>{imp.metric}<small style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>{imp.metricLabel}</small></div>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", gap: 14, marginBottom: 14 }}>
        <section style={card}>
          <h3 style={h3}>Workload by person</h3>
          <div style={hint}>Everyone&rsquo;s tasks. Percentage is overdue out of that person&rsquo;s open tasks.</div>
          <Legend items={[[BLUE, "Open, not late"], [RED, "Overdue"], [GREY, "Done"]]} />
          {s.people.map((p) => (
            <Link key={p.name} href={q(`person=${encodeURIComponent(p.name)}`)} style={{ textDecoration: "none", color: "inherit", display: "block", borderRadius: 8 }}>
              <Row3 left={p.name} right={`${p.open} open, ${p.overdue} overdue (${fmtPct(p.overdue, p.open)})`}
                mid={<Segments total={maxPerson} parts={[{ n: p.open - p.overdue, color: BLUE }, { n: p.overdue, color: RED }, { n: p.done, color: GREY }]} />} />
            </Link>
          ))}
        </section>
        <section style={card}>
          <h3 style={h3}>By source</h3>
          <div style={hint}>Where each task lives today.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["SOURCE", "TASKS", "OPEN", "OVERDUE", "DONE"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", fontSize: 11, letterSpacing: ".05em", color: "var(--muted-foreground)", padding: 8, borderBottom: "1px solid #E2E6ED" }}>{h}</th>)}</tr></thead>
            <tbody>
              {s.sources.map((x) => (
                <tr key={x.source}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #EEF1F6" }}>{x.label}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>{x.total}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>{x.open}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #EEF1F6", textAlign: "right", color: x.overdue ? RED : undefined, fontWeight: x.overdue ? 600 : 400 }}>{x.overdue}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>{x.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 14 }}>
        <section style={card}>
          <h3 style={h3}>How late are the open tasks</h3>
          <div style={hint}>{(ag.over30 + ag.under30 + ag.today + ag.next7 + ag.later).toLocaleString()} open tasks, by due date.</div>
          <Segments height={26} total={agTotal} parts={[{ n: ag.over30, color: "#8E1B10" }, { n: ag.under30, color: "#D9534F" }, { n: ag.today, color: "#F0A30A" }, { n: ag.next7, color: BLUE }, { n: ag.later, color: GREY }]} />
          <div style={{ display: "grid", gap: 6, fontSize: 12.5, marginTop: 10 }}>
            {([["#8E1B10", "Overdue 30 days or more", ag.over30], ["#D9534F", "Overdue under 30 days", ag.under30], ["#F0A30A", "Due today", ag.today], [BLUE, "Due in the next 7 days", ag.next7], [GREY, "Later or no due date", ag.later]] as Array<[string, string, number]>).map(([c, l, n]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: c, display: "inline-block" }} />{l}<b style={{ marginLeft: "auto" }}>{n}</b></div>
            ))}
          </div>
        </section>
        <section style={card}>
          <h3 style={h3}>Sales tasks created and completed per week</h3>
          <div style={hint}>Last 8 weeks, by week starting Monday.</div>
          <Legend items={[[BLUE, "Created"], [GREEN, "Completed"]]} />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 170, borderBottom: "1px solid #E2E6ED" }}>
            {s.weeks.map((w) => (
              <div key={w.weekStart} style={{ flex: 1, display: "flex", gap: 3, alignItems: "flex-end", justifyContent: "center", height: "100%", paddingTop: 16 }}>
                {[[w.created, BLUE], [w.completed, GREEN]].map(([n, c], i) => (
                  <span key={i} style={{ position: "relative", width: 14, height: `${Math.max(n ? 2 : 0, Math.round(((n as number) / maxWeek) * 140))}px`, background: c as string, borderRadius: "3px 3px 0 0" }}>
                    <em style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontStyle: "normal", fontSize: 10, color: "#4A5568" }}>{n as number}</em>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>{s.weeks.map((w) => <div key={w.weekStart} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "var(--muted-foreground)", paddingTop: 6 }}>{w.weekStart.slice(5)}</div>)}</div>
        </section>
      </div>

      <section style={card}>
        <h3 style={h3}>Who creates the sales tasks</h3>
        <div style={hint}>By the person who created (assigned) them. The orange part is tasks left unassigned.</div>
        {s.creators.map((c) => (
          <Row3 key={c.name} left={c.name} right={`${c.total} tasks${c.unassigned ? `, ${c.unassigned} unassigned` : ""}`}
            mid={<Segments total={maxCreator} parts={[{ n: c.total - c.unassigned, color: BLUE }, { n: c.unassigned, color: "#F0A30A" }]} />} />
        ))}
      </section>
    </div>
  );
}

export function MyTaskSummary({ name, s }: { name: string; s: TaskSummary }) {
  const notLate = s.open - s.overdue;
  const q = (extra: string) => `${BASE}?view=tasks&scope=my&${extra}`;
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: "0 0 4px", fontWeight: 600 }}>My task summary</h2>
      <div style={hint}>Only tasks assigned to {name}.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="My tasks" value={s.total} sub="All sources" href={q("filter=none")} />
        <Kpi label="Open" value={s.open} sub={`${fmtPct(s.open, s.total)} of my tasks`} href={q("filter=open")} />
        <Kpi label="Overdue" value={s.overdue} sub={`${fmtPct(s.overdue, s.open)} of my open tasks`} href={q("filter=overdue")} late />
        <Kpi label="Done" value={s.done} sub={`${fmtPct(s.done, s.total)} of my tasks`} href={q("filter=done")} />
      </div>
      <section style={card}>
        <h3 style={h3}>My workload</h3>
        <div style={hint}>{s.open} open, {s.overdue} of them overdue, {s.done} done.</div>
        <Legend items={[[BLUE, "Open, not late"], [RED, "Overdue"], [GREY, "Done"]]} />
        <Segments height={28} total={Math.max(1, s.total)} parts={[{ n: notLate, color: BLUE }, { n: s.overdue, color: RED }, { n: s.done, color: GREY }]} />
      </section>
    </div>
  );
}

