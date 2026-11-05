"use client";
// Task report list. Target: src/app/admin/sales/task-report/TaskReportTable.tsx
// Reuses OdooSearchBar (same Filters / Group by / Favorites as Sales > Tasks) and the shared downloadCsv / NewButton.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewButton, downloadCsv } from "@/components/admin/ToolbarGear";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";

export type Row = {
  id: string; source: "sales" | "ir" | "admin" | "general"; sourceLabel: string; title: string; type: string | null;
  due: string | null; status: "open" | "done"; assigneeId: string | null; assigneeName: string | null;
  createdByName: string | null; createdAt: string; contactName: string | null; href: string;
};

type Scope = "my" | "team" | "all";
type Quick = "none" | "overdue" | "open" | "done" | "unassigned";

const COLS = [
  { key: "task", label: "Task", on: true, w: 260 },
  { key: "source", label: "Source", on: false, w: 90 },
  { key: "type", label: "Type", on: true, w: 100 },
  { key: "contact", label: "Contact", on: true, w: 160 },
  { key: "due", label: "Due date", on: true, w: 120 },
  { key: "assignee", label: "Assignee", on: true, w: 140 },
  { key: "by", label: "Assigned by", on: true, w: 140 },
  { key: "status", label: "Status", on: true, w: 90 },
  { key: "created", label: "Created on", on: false, w: 110 },
  { key: "actions", label: "", on: true, w: 170 },
] as const;
type ColKey = (typeof COLS)[number]["key"];
const STORE = "icapos.taskReport.columns";
const defaultCols = (): Record<ColKey, boolean> => Object.fromEntries(COLS.map((c) => [c.key, c.on])) as Record<ColKey, boolean>;

const QUICK = [
  { key: "overdue", label: "Overdue" }, { key: "today", label: "Due today" }, { key: "week", label: "This week" }, { key: "no_date", label: "No due date" },
  { key: "open", label: "Open", sep: true }, { key: "done", label: "Done" }, { key: "unassigned", label: "Unassigned" },
];
const GROUPS = [
  { id: "none", label: "None" }, { id: "assignee", label: "Assignee" }, { id: "by", label: "Assigned by" }, { id: "due", label: "Due date" },
  { id: "type", label: "Type" }, { id: "contact", label: "Contact" }, { id: "source", label: "Source" },
];

function isOverdue(r: Row, today: string) { return r.status === "open" && !!r.due && r.due < today; }

function dueLabel(r: Row, today: string): { text: string; color: string } {
  if (!r.due) return { text: "No date", color: "var(--muted-foreground)" };
  if (r.status === "done") return { text: r.due, color: "var(--muted-foreground)" }; // a finished task is never "overdue"
  if (r.due < today) return { text: `${Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.due}T00:00:00Z`)) / 86400000)}d overdue`, color: "#A32D2D" };
  if (r.due === today) return { text: "Today", color: "#854F0B" };
  return { text: r.due, color: "var(--muted-foreground)" };
}

export function TaskReportTable({ rows, isSuper, meId, today, initialQuick = "none", initialPerson = "", initialScope = "my" }: {
  rows: Row[]; isSuper: boolean; meId: string; today: string; initialQuick?: Quick; initialPerson?: string; initialScope?: Scope;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [search, setSearch] = useState<SearchState>({
    ...EMPTY_SEARCH, groupBy: "none",
    quick: initialQuick === "none" ? [] : [initialQuick],
    fields: initialPerson ? { assignee: [initialPerson] } : {},
  });
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

  const searchFields = useMemo(() => [
    { key: "type", label: "Type", options: [...new Set(scoped.map((r) => r.type ?? "No type"))].sort() },
    { key: "assignee", label: "Assignee", options: [...new Set(scoped.map((r) => r.assigneeName ?? "Unassigned"))].sort() },
    { key: "by", label: "Assigned by", options: [...new Set(scoped.map((r) => r.createdByName ?? "Not recorded"))].sort() },
    { key: "source", label: "Source", options: [...new Set(scoped.map((r) => r.sourceLabel))].sort() },
  ], [scoped]);

  const visible = useMemo(() => {
    const { q, quick, fields } = search;
    const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    return scoped.filter((r) => {
      if (!textMatch(q, r.title, r.contactName, r.assigneeName, r.createdByName, r.type, r.sourceLabel)) return false;
      if (quick.includes("overdue") && !isOverdue(r, today)) return false;
      if (quick.includes("today") && r.due !== today) return false;
      if (quick.includes("week") && !(r.due && r.due >= today && r.due <= weekEnd)) return false;
      if (quick.includes("no_date") && r.due) return false;
      if (quick.includes("open") && r.status !== "open") return false;
      if (quick.includes("done") && r.status !== "done") return false;
      if (quick.includes("unassigned") && r.assigneeId) return false;
      if (fields.type?.length && !fields.type.includes(r.type ?? "No type")) return false;
      if (fields.assignee?.length && !fields.assignee.includes(r.assigneeName ?? "Unassigned")) return false;
      if (fields.by?.length && !fields.by.includes(r.createdByName ?? "Not recorded")) return false;
      if (fields.source?.length && !fields.source.includes(r.sourceLabel)) return false;
      return true;
    });
  }, [scoped, search, today]);

  const groups = useMemo(() => {
    const g = search.groupBy || "none";
    if (g === "none") return null;
    const keyOf = (r: Row) => g === "assignee" ? (r.assigneeName ?? "Unassigned")
      : g === "by" ? (r.createdByName ?? "Not recorded")
      : g === "due" ? (!r.due ? "No due date" : r.status === "done" ? "Done" : r.due < today ? "Overdue" : r.due === today ? "Today" : "Upcoming")
      : g === "type" ? (r.type ?? "No type")
      : g === "source" ? r.sourceLabel
      : (r.contactName ?? "No contact");
    const map = new Map<string, Row[]>();
    for (const r of visible) { const k = keyOf(r); (map.get(k) ?? map.set(k, []).get(k)!).push(r); }
    return [...map.entries()];
  }, [visible, search.groupBy, today]);

  const shown = COLS.filter((c) => cols[c.key]);
  const minWidth = shown.reduce((n, c) => n + c.w, 0);

  async function markDone(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }); router.refresh(); }
    finally { setBusy(false); }
  }

  const tab = (on: boolean): React.CSSProperties => ({ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 5, padding: "5px 10px", background: on ? "#2E78F5" : "transparent", color: on ? "#fff" : "var(--muted-foreground)" });
  const cellBase: React.CSSProperties = { padding: "9px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" };
  const heading: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" };

  function renderRow(r: Row) {
    const due = dueLabel(r, today);
    const done = r.status === "done";
    return (
      <tr key={`${r.source}:${r.id}`} style={{ borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
        {shown.map((c) => {
          switch (c.key) {
            case "task": return <td key={c.key} title={r.title} style={{ ...cellBase, fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-foreground)" : "var(--foreground)" }}>{r.title}</td>;
            case "source": return <td key={c.key} style={{ ...cellBase, fontSize: 11, color: "var(--muted-foreground)" }}>{r.sourceLabel}</td>;
            case "type": return <td key={c.key} style={{ ...cellBase, fontSize: 11 }}>{r.type ?? "None"}</td>;
            case "contact": return <td key={c.key} title={r.contactName ?? ""} style={{ ...cellBase, fontSize: 11.5 }}>{r.contactName ?? <span style={{ color: "var(--muted-foreground)" }}>None</span>}</td>;
            case "due": return <td key={c.key} style={{ ...cellBase, fontSize: 11, color: due.color }}>{due.text}</td>;
            case "assignee": return <td key={c.key} title={r.assigneeName ?? ""} style={{ ...cellBase, fontSize: 11, color: "var(--muted-foreground)" }}>{r.assigneeName ?? "Unassigned"}</td>;
            case "by": return <td key={c.key} title={r.createdByName ?? ""} style={{ ...cellBase, fontSize: 11, color: "var(--muted-foreground)" }}>{r.createdByName ?? "Not recorded"}</td>;
            case "status": return <td key={c.key} style={cellBase}><span style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", color: done ? "#0F6E56" : "#854F0B", background: done ? "#E1F5EE" : "#FAEEDA" }}>{done ? "Done" : "Open"}</span></td>;
            case "created": return <td key={c.key} style={{ ...cellBase, fontSize: 11, color: "var(--muted-foreground)" }}>{r.createdAt.slice(0, 10)}</td>;
            default: return (
              <td key={c.key} style={cellBase}>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
                  {!done && r.source === "sales" && <button type="button" onClick={() => markDone(r.id)} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /> Done</button>}
                  <Link href={r.href} style={{ fontSize: 10.5, color: "#4338CA", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>Open to view</Link>
                </div>
              </td>);
          }
        })}
      </tr>
    );
  }

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
                <div style={heading}>Show columns</div>
                {COLS.filter((c) => c.key !== "actions").map((c) => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 13px", fontSize: 12.5, cursor: c.key === "task" ? "default" : "pointer", color: c.key === "task" ? "var(--muted-foreground)" : "var(--foreground)" }}>
                    <input type="checkbox" checked={cols[c.key]} disabled={c.key === "task"} onChange={(e) => saveCols({ ...cols, [c.key]: e.target.checked })} />
                    {c.label}
                  </label>
                ))}
                <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />
                <button type="button" onClick={() => saveCols(defaultCols())} style={{ width: "100%", textAlign: "left", padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "#4338CA", fontWeight: 600 }}>Reset to default</button>
                <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />
                <button type="button" onClick={() => { setMenu(false); downloadCsv(`task-report-${today}.csv`, ["Task", "Source", "Type", "Contact", "Due", "Status", "Assignee", "Assigned by", "Created"], visible.map((r) => [r.title, r.sourceLabel, r.type ?? "", r.contactName ?? "", r.due ?? "", r.status, r.assigneeName ?? "", r.createdByName ?? "", r.createdAt.slice(0, 10)])); }}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                  <i className="ti ti-download" style={{ fontSize: 15, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>Export all</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{visible.length.toLocaleString()} matching</span>
                </button>
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
        <OdooSearchBar scope="task-report" state={search} onChange={setSearch} quick={QUICK} fields={searchFields} groups={GROUPS} noGroupId="none" placeholder="Search task, contact, assignee…" width={440} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth, tableLayout: "fixed", borderCollapse: "collapse" }}>
          <colgroup>{shown.map((c) => <col key={c.key} style={{ width: c.w }} />)}</colgroup>
          <thead>
            <tr style={{ background: "#F7F9FC" }}>
              {shown.map((c) => <th key={c.key} style={{ ...cellBase, padding: "8px 10px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", textAlign: "left" }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={shown.length} style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No tasks match.</td></tr>
            ) : groups ? groups.map(([name, list]) => (
              <FragmentGroup key={name} name={name} count={list.length} span={shown.length}>{list.map(renderRow)}</FragmentGroup>
            )) : visible.map(renderRow)}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, color: "var(--muted-foreground)" }}>
        Showing {visible.length.toLocaleString()} of {scoped.length.toLocaleString()} tasks.
      </div>
    </div>
  );
}

function FragmentGroup({ name, count, span, children }: { name: string; count: number; span: number; children: React.ReactNode }) {
  return (
    <>
      <tr style={{ background: "#F3F4F6" }}><td colSpan={span} style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600 }}>{name} ({count})</td></tr>
      {children}
    </>
  );
}
