"use client";

/**
 * The Opportunities and Pipeline views inside a contact's Tasks tab. Opportunities groups the
 * contact's tasks under each opportunity; Pipeline lays those opportunities out by stage with
 * the next task on each card. Tasks are completed with the same handler as the All view.
 */
import Link from "next/link";
import { groupByStage, groupTasksByOpportunity, type GroupOpp, type GroupTask, type OppTaskGroup } from "@/lib/sales/contact-task-groups";
import { ptToday } from "@/lib/reminders/pt";

const money = (c: number | null) => (c == null ? "" : `$${Math.round(c / 100).toLocaleString("en-US")}`);
const dayLabel = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No date");

function dueStyle(task: GroupTask, today: string): { bg: string; fg: string; label: string } {
  const d = task.due_date ? task.due_date.slice(0, 10) : null;
  if (d && d < today) return { bg: "#FCEBEB", fg: "#A32D2D", label: `Overdue · ${dayLabel(d)}` };
  if (d && d === today) return { bg: "#FAEEDA", fg: "#854F0B", label: "Today" };
  return { bg: "#F4F5F7", fg: "#5F5E5A", label: dayLabel(d) };
}

export function ContactTaskViews({ view, opps, tasks, loaded, busy, onDone }: {
  view: "opps" | "pipeline"; opps: GroupOpp[]; tasks: GroupTask[]; loaded: boolean; busy: boolean; onDone: (id: string) => void;
}) {
  if (!loaded) return <p style={{ marginTop: 12, padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</p>;
  const today = ptToday();
  const groups = groupTasksByOpportunity(opps, tasks, today);
  if (opps.length === 0 && tasks.length === 0) {
    return <p style={{ marginTop: 12, padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>No opportunities or tasks for this contact yet.</p>;
  }

  if (view === "pipeline") {
    const cols = groupByStage(groups);
    if (cols.length === 0) return <p style={{ marginTop: 12, padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>No opportunities in the pipeline for this contact.</p>;
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 8 }}>Where this contact&rsquo;s opportunities sit in the pipeline, with the next task on each.</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(190px, 1fr))`, gap: 10, overflowX: "auto" }}>
          {cols.map((c) => (
            <div key={c.stage} style={{ background: "#F7F9FC", border: "0.5px solid #eef1f5", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted-foreground)", display: "flex", justifyContent: "space-between" }}><span>{c.stage}</span><span>{c.groups.length}</span></div>
              {c.groups.map((g) => {
                const st = g.next ? dueStyle(g.next, today) : null;
                return (
                  <Link key={g.opp!.id} href={`/admin/sales/opportunities/${g.opp!.id}`} style={{ textDecoration: "none", color: "inherit", background: "#fff", border: "0.5px solid #e3e7ee", borderRadius: 8, padding: 9, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.opp!.title}</span>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{money(g.opp!.value_cents)}</span>
                    {g.next && st ? (
                      <span title={g.next.title} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, padding: "4px 7px", borderRadius: 6, background: st.bg, color: st.fg, minWidth: 0 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.next.title}</span>
                        <span style={{ whiteSpace: "nowrap" }}>{st.label}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>No pending task</span>
                    )}
                    {g.open > 1 && <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{g.open} open tasks{g.overdue ? ` · ${g.overdue} overdue` : ""}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((g) => (
        <div key={g.opp?.id ?? "loose"} style={{ border: "0.5px solid #eef1f5", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "9px 12px", background: "#F7F9FC", borderBottom: "0.5px solid #eef1f5" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              {g.opp ? <Link href={`/admin/sales/opportunities/${g.opp.id}`} style={{ color: "inherit", textDecoration: "none" }}>{g.opp.title}</Link> : "Not linked to an opportunity"}
              {g.opp?.stage_name && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", borderRadius: 999, padding: "2px 8px" }}>{g.opp.stage_name}</span>}
            </span>
            <span style={{ fontSize: 11, color: g.overdue ? "#A32D2D" : "var(--muted-foreground)" }}>{g.opp ? `${money(g.opp.value_cents)} · ` : ""}{g.open} open{g.overdue ? ` · ${g.overdue} overdue` : ""}</span>
          </div>
          {g.tasks.length === 0 ? (
            <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)" }}>No tasks on this opportunity yet.</p>
          ) : g.tasks.map((t) => {
            const done = t.status === "done";
            const st = dueStyle(t, today);
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                <span style={{ minWidth: 0, textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-foreground)" : "var(--foreground)" }}>{t.title} <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 8, padding: "1px 7px" }}>{t.task_type}</span></span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {t.assignee_name && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.assignee_name}</span>}
                  {done ? <span style={{ fontSize: 10.5, color: "#0F6E56", background: "#E1F5EE", borderRadius: 999, padding: "2px 9px" }}>Done</span> : (
                    <>
                      <span style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", background: st.bg, color: st.fg }}>{st.label}</span>
                      <button type="button" aria-label={`Mark ${t.title} done`} onClick={() => onDone(t.id)} disabled={busy} style={{ fontSize: 11, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
