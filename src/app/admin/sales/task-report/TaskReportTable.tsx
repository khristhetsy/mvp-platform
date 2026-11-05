"use client";
// Task report list. Target: src/app/admin/sales/task-report/TaskReportTable.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewButton, downloadCsv } from "@/components/admin/ToolbarGear";

export type Row = {
  id: string; source: "sales" | "ir" | "admin" | "general"; sourceLabel: string; title: string; type: string | null;
  due: string | null; status: "open" | "done"; assigneeId: string | null; assigneeName: string | null;
  createdByName: string | null; createdAt: string; contactName: string | null; href: string;
};

type Scope = "my" | "team" | "all";
type Quick = "none" | "overdue" | "open" | "done" | "unassigned";

const COLS = [
  { key: "task", label: "Task", on: true },
  { key: "source", label: "Source", on: false },
  { key: "type", label: "Type", on: true },
  { key: "due", label: "Due date", on: true },
  { key: "assignee", label: "Assignee", on: true },
  { key: "by", label: "Assigned by", on: true },
  { key: "status", label: "Status", on: true },
  { key: "created", label: "Created on", on: false },
  { key: "actions", label: "Actions", on: true },
] as const;
type ColKey = (typeof COLS)[number]["key"];
const STORE = "icapos.taskReport.columns";
const defaultCols = (): Record<ColKey, boolean> => Object.fromEntries(COLS.map((c) => [c.key, c.on])) as Record<ColKey, boolean>;

function dueLabel(d: string | null, today: string): { text: string; color: string } {
  if (!d) return { text: "No date", color: "var(--muted-foreground)" };
  if (d < today) return { text: `${Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000)}d overdue`, color: "#A32D2D" };
  if (d === today) return { text: "Today", color: "#854F0B" };
  return { text: d, color: "var(--muted-foreground)" };
}

export function TaskReportTable({ rows, isSuper, meId, today, initialQuick = "none", initialPerson = "", initialScope = "my" }: {
  rows: Row[]; isSuper: boolean; meId: string; today: string; initialQuick?: Quick; initialPerson?: string; initialScope?: Scope;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [quick, setQuick] = useState<Quick>(initialQuick);
  const [person, setPerson] = useState(initialPerson);
  const [q, setQ] = useState("");
  const [cols, setCols] = useState<Record<ColKey, boolean>>(defaultCols);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved column choice after mount
  useEffect(() => { try { const raw = localStorage.getItem(STORE); if (raw) setCols({ ...defaultCols(), ...JSON.parse(raw) }); } catch { /* ignore */ } }, []);
  function saveCols(next: Record<ColKey, boolean>) { setCols(next); try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ } }

  const scoped = useMemo(() => {
    if (!isSuper) return rows; // the server already limited non-super admins to their own tasks
    if (scope === "my") return rows.filter((r) => r.assigneeId === meId);
    if (scope === "team") return rows.filter((r) => r.assigneeId !== meId);
    return rows;
  }, [rows, scope, isSuper, meId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((r) => {
      if (quick === "overdue" && !(r.status === "open" && r.due && r.due < today)) return false;
      if (quick === "open" && r.status !== "open") return false;
      if (quick === "done" && r.status !== "done") return false;
      if (quick === "unassigned" && r.assigneeId) return false;
      if (person && (r.assigneeName ?? "Unassigned") !== person) return false;
      if (needle && !`${r.title} ${r.contactName ?? ""} ${r.assigneeName ?? ""} ${r.type ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [scoped, quick, person, q, today]);

  const overdueCount = useMemo(() => scoped.filter((r) => r.status === "open" && r.due && r.due < today).length, [scoped, today]);
  const shown = COLS.filter((c) => cols[c.key]);

  async function markDone(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }); router.refresh(); }
    finally { setBusy(false); }
  }

  const tab = (on: boolean, danger = false): React.CSSProperties => ({ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 5, padding: "5px 10px", background: on ? "#2E78F5" : "transparent", color: on ? "#fff" : danger ? "#A32D2D" : "var(--muted-foreground)" });
  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", minWidth: 200 };
  const grid = `repeat(${shown.length}, minmax(0, 1fr))`;
  const widths: Record<ColKey, string> = { task: "minmax(220px,2.4fr)", source: "80px", type: "92px", due: "104px", assignee: "130px", by: "130px", status: "80px", created: "100px", actions: "minmax(150px,auto)" };
  const template = shown.map((c) => widths[c.key]).join(" ") || grid;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
        <NewButton href="/admin/sales/tasks" />
        <div style={{ position: "relative" }}>
          <button type="button" aria-label="Table settings" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: menu ? "var(--muted)" : "#fff", color: "var(--muted-foreground)", cursor: "pointer" }}>
            <i className="ti ti-settings" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
          {menu && (
            <>
              <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, width: 240, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "5px 0" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>Tasks</div>
                <button type="button" onClick={() => { setMenu(false); downloadCsv(`task-report-${today}.csv`, ["Task", "Source", "Type", "Due", "Status", "Assignee", "Assigned by", "Contact", "Created"], visible.map((r) => [r.title, r.sourceLabel, r.type ?? "", r.due ?? "", r.status, r.assigneeName ?? "", r.createdByName ?? "", r.contactName ?? "", r.createdAt.slice(0, 10)])); }}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                  <i className="ti ti-download" style={{ fontSize: 15, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>Export all</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{visible.length.toLocaleString()} matching</span>
                </button>
                <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>Columns</div>
                {COLS.map((c) => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 13px", fontSize: 12.5, cursor: c.key === "task" ? "default" : "pointer", opacity: c.key === "task" ? 0.6 : 1 }}>
                    <input type="checkbox" checked={cols[c.key]} disabled={c.key === "task"} onChange={(e) => saveCols({ ...cols, [c.key]: e.target.checked })} />
                    {c.label}
                  </label>
                ))}
                <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />
                <button type="button" onClick={() => saveCols(defaultCols())} style={{ width: "100%", textAlign: "left", padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "#4338CA", fontWeight: 600 }}>Reset to default</button>
              </div>
            </>
          )}
        </div>
        {isSuper && (
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: 7, padding: 2 }}>
            <button type="button" onClick={() => setScope("team")} style={tab(scope === "team")}>Team</button>
            <button type="button" onClick={() => setScope("my")} style={tab(scope === "my")}>My</button>
            <button type="button" onClick={() => setScope("all")} style={tab(scope === "all")}>All</button>
          </div>
        )}
        <button type="button" onClick={() => setQuick(quick === "overdue" ? "none" : "overdue")} style={{ ...tab(quick === "overdue", true), border: "0.5px solid var(--border)" }}>Overdue{overdueCount ? ` ${overdueCount}` : ""}</button>
        {(quick === "open" || quick === "done" || quick === "unassigned" || person) && (
          <button type="button" onClick={() => { setQuick("none"); setPerson(""); }} style={{ fontSize: 11, border: "0.5px solid var(--border)", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", padding: "4px 10px", cursor: "pointer" }}>
            {[quick !== "none" ? quick : "", person].filter(Boolean).join(", ")} ✕
          </button>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search task or contact" aria-label="Search tasks" style={inp} />
      </div>

      <style>{`.trHead,.trRow{display:grid;gap:10px;align-items:center;min-width:900px}.trWrap{overflow-x:auto}`}</style>
      <div className="trWrap">
        <div className="trHead" style={{ gridTemplateColumns: template, padding: "8px 14px", background: "#F7F9FC", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
          {shown.map((c) => <span key={c.key} style={{ textAlign: c.key === "actions" ? "right" : "left" }}>{c.label}</span>)}
        </div>
        {visible.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No tasks match.</p>
        ) : visible.map((r) => {
          const due = dueLabel(r.due, today);
          const done = r.status === "done";
          return (
            <div key={`${r.source}:${r.id}`} className="trRow" style={{ gridTemplateColumns: template, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
              {shown.map((c) => {
                switch (c.key) {
                  case "task": return (
                    <div key={c.key} style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-foreground)" : "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                      {r.contactName && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.contactName}</div>}
                    </div>);
                  case "source": return <span key={c.key} style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.sourceLabel}</span>;
                  case "type": return <span key={c.key} style={{ fontSize: 11 }}>{r.type ?? "-"}</span>;
                  case "due": return <span key={c.key} style={{ fontSize: 11, color: done ? "var(--muted-foreground)" : due.color }}>{due.text}</span>;
                  case "assignee": return <span key={c.key} style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.assigneeName ?? "Unassigned"}</span>;
                  case "by": return <span key={c.key} style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.createdByName ?? "Not recorded"}</span>;
                  case "status": return <span key={c.key} style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", justifySelf: "start", color: done ? "#0F6E56" : "#854F0B", background: done ? "#E1F5EE" : "#FAEEDA" }}>{done ? "Done" : "Open"}</span>;
                  case "created": return <span key={c.key} style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.createdAt.slice(0, 10)}</span>;
                  default: return (
                    <div key={c.key} style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {!done && r.source === "sales" && <button type="button" onClick={() => markDone(r.id)} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /> Done</button>}
                      <Link href={r.href} style={{ fontSize: 10.5, color: "#4338CA", textDecoration: "none", fontWeight: 600 }}>Open to view</Link>
                    </div>);
                }
              })}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, color: "var(--muted-foreground)" }}>
        Showing {visible.length.toLocaleString()} of {scoped.length.toLocaleString()} tasks.
      </div>
    </div>
  );
}
