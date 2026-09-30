"use client";

/**
 * Tasks hub › "All founders", Odoo style (the Deals2Match "All Tasks" kanban).
 *
 * Columns are founder × month stages ("Michael Doyle 2nd Month", only those with tasks); each card is one weekly
 * batch with all its investors as tags. Toolbar follows the admin list pattern: New, gear,
 * Odoo search bar (filters / group by / favorites), view switcher. Group by "Week" (or the
 * calendar view) shows the original weekly board, unchanged.
 *
 * Drag a card onto another month of the same founder to move it: it lands on the week at
 * the same position in that month, and its deadline (if it has one) shifts by the same number of days.
 * Clicking a card opens the side panel (investor checklist, status, star).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { HScrollBoard } from "@/components/admin/HScrollBoard";
import { OdooSearchBar, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";
import { NewButton, ToolbarGear } from "@/components/admin/ToolbarGear";
import { AllFoundersBoard } from "./AllFoundersBoard";
import { TaskSidePanel } from "./TaskSidePanel";

type Task = {
  id: string; project_id: string; milestone_id: string; title: string; status: "new" | "in_progress" | "done"; starred: boolean;
  deadline: string | null; created_at: string; assignee_id: string | null; assignee_name: string | null;
  week: { label: string; starts_on: string; ends_on: string } | null; investors: number; investor_names: string[];
};
type Project = { id: string; title: string; founder_name: string | null };
type Month = { id: string; project_id: string; label: string; sort_order: number; starts_on: string; ends_on: string };
type Week = Month & { parent_id: string | null };
type Data = { projects: Project[]; months: Month[]; weeks: Week[]; tasks: Task[] };
type Column = { id: string; project_id: string; label: string; monthId: string | null; tasks: Task[] };
type Due = "overdue" | "today" | "planned" | "done" | "none";

const COLORS = ["#4F46E5", "#EA580C", "#0F766E", "#DB2777", "#7C3AED", "#16A34A", "#0284C7", "#CA8A04"];
const DUE_COLOR: Record<Due, string> = { overdue: "#DC2626", today: "#F59E0B", planned: "#16A34A", done: "#64748B", none: "#CBD5E1" };
const DUE_LABEL: Record<Due, string> = { overdue: "Overdue", today: "Due today", planned: "Planned", done: "Done", none: "No deadline" };
const FOLD_KEY = "ir.tasks.folded";
const DAY = 86_400_000;

const QUICK = [
  { key: "open", label: "Open tasks" }, { key: "done", label: "Done" },
  { key: "mine", label: "My tasks", sep: true }, { key: "starred", label: "Starred" },
  { key: "overdue", label: "Overdue", sep: true }, { key: "today", label: "Due today" },
];
const GROUPS = [{ id: "founder_month", label: "Founder, month" }, { id: "founder", label: "Founder" }, { id: "week", label: "Week" }];
const START: SearchState = { q: "", quick: ["open"], fields: {}, groupBy: "founder_month" };

const today = () => new Date().toISOString().slice(0, 10);
const dueOf = (t: Task): Due => t.status === "done" ? "done" : !t.deadline ? "none" : t.deadline < today() ? "overdue" : t.deadline === today() ? "today" : "planned";
const ordinal = (n: number) => { const r = n % 100; return `${n}${r >= 11 && r <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`; };
const initials = (n: string | null) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const fmtShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);

export function OdooTasksBoard({ meId }: { meId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>(START);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [fold, setFold] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/ir/tasks");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Couldn't load tasks."); else { setError(null); setData(j); }
  }, []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- load() sets state after the fetch resolves, not synchronously
  useEffect(() => {
    try { const s = window.localStorage.getItem(FOLD_KEY); if (s) setFold(JSON.parse(s)); } catch { /* ignore */ } // eslint-disable-line react-hooks/set-state-in-effect -- restore folds after mount (no localStorage during SSR)
  }, []);
  const toggleFold = (id: string, now: boolean) => setFold((f) => { const x = { ...f, [id]: !now }; try { window.localStorage.setItem(FOLD_KEY, JSON.stringify(x)); } catch { /* ignore */ } return x; });

  const color = useMemo(() => new Map((data?.projects ?? []).map((p, i) => [p.id, COLORS[i % COLORS.length]])), [data]);
  const founder = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.id, p.founder_name ?? p.title])), [data]);
  const weekById = useMemo(() => new Map((data?.weeks ?? []).map((w) => [w.id, w])), [data]);

  const passes = useCallback((t: Task) => {
    const q = search.quick;
    const status = q.filter((k) => k === "open" || k === "done");
    if (status.length && !status.some((k) => (k === "open" ? t.status !== "done" : t.status === "done"))) return false;
    if (q.includes("mine") && t.assignee_id !== meId) return false;
    if (q.includes("starred") && !t.starred) return false;
    const due: string[] = q.filter((k) => k === "overdue" || k === "today");
    if (due.length && !due.includes(dueOf(t))) return false;
    const f = search.fields;
    if (f.founder?.length && !f.founder.includes(founder.get(t.project_id) ?? "")) return false;
    if (f.assignee?.length && !f.assignee.includes(t.assignee_name ?? "Unassigned")) return false;
    if (search.q && !textMatch(search.q, t.title, founder.get(t.project_id), t.week?.label, t.assignee_name, ...t.investor_names)) return false;
    return true;
  }, [search, meId, founder]);

  const grouping = search.groupBy === "founder" ? "founder" : "founder_month";
  const columns: Column[] = useMemo(() => {
    if (!data) return [];
    const shown = data.tasks.filter(passes);
    const out: Column[] = [];
    for (const p of data.projects) {
      const mine = shown.filter((t) => t.project_id === p.id);
      const name = founder.get(p.id) ?? "Founder";
      if (grouping === "founder") { out.push({ id: p.id, project_id: p.id, label: name, monthId: null, tasks: mine }); continue; }
      for (const m of data.months.filter((x) => x.project_id === p.id).sort((a, b) => a.sort_order - b.sort_order)) {
        out.push({ id: m.id, project_id: p.id, label: `${name} ${ordinal(m.sort_order)} Month`, monthId: m.id, tasks: mine.filter((t) => weekById.get(t.milestone_id)?.parent_id === m.id) });
      }
      const loose = mine.filter((t) => !weekById.get(t.milestone_id)?.parent_id);
      if (loose.length) out.push({ id: `${p.id}:none`, project_id: p.id, label: `${name}, no month`, monthId: null, tasks: loose });
    }
    for (const c of out) c.tasks.sort((a, b) => (weekById.get(b.milestone_id)?.sort_order ?? 0) - (weekById.get(a.milestone_id)?.sort_order ?? 0) || b.title.localeCompare(a.title));
    return out;
  }, [data, passes, grouping, founder, weekById]);

  async function patchTask(id: string, body: Record<string, unknown>, local: Partial<Task>) {
    const before = data?.tasks.find((t) => t.id === id);
    setData((d) => d && { ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, ...local } : t) });
    const r = await fetch(`/api/admin/ir/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Couldn't update the task.");
      if (before) setData((d) => d && { ...d, tasks: d.tasks.map((t) => t.id === id ? before : t) });
    }
  }

  /** Same-founder month columns only; the week keeps its position inside the month. */
  function canDrop(col: Column) {
    const t = data?.tasks.find((x) => x.id === dragId);
    return !!t && grouping === "founder_month" && !!col.monthId && col.project_id === t.project_id && weekById.get(t.milestone_id)?.parent_id !== col.monthId;
  }
  function drop(col: Column) {
    const t = data?.tasks.find((x) => x.id === dragId);
    setDragId(null); setOverCol(null);
    if (!t || !data || !canDrop(col)) return;
    const from = weekById.get(t.milestone_id);
    const weeksIn = (monthId: string | null | undefined) => data.weeks.filter((w) => w.parent_id === monthId).sort((a, b) => a.sort_order - b.sort_order);
    const target = weeksIn(col.monthId);
    if (!target.length) { setError("That month has no weeks yet."); return; }
    const pos = from ? Math.max(0, weeksIn(from.parent_id).findIndex((w) => w.id === from.id)) : 0;
    const to = target[Math.min(pos, target.length - 1)];
    const week = { label: to.label, starts_on: to.starts_on, ends_on: to.ends_on };
    if (!t.deadline || !from) { void patchTask(t.id, { milestoneId: to.id }, { milestone_id: to.id, week }); return; } // no deadline stays no deadline
    const deadline = addDays(t.deadline, daysBetween(from.starts_on, to.starts_on));
    void patchTask(t.id, { milestoneId: to.id, deadline }, { milestone_id: to.id, deadline, week });
  }

  async function createIn(projectId: string, monthId: string | null) {
    if (!data) return;
    const weeks = data.weeks.filter((w) => w.project_id === projectId && (!monthId || w.parent_id === monthId)).sort((a, b) => a.sort_order - b.sort_order);
    const used = new Set(data.tasks.map((t) => t.milestone_id));
    const week = weeks.find((w) => !used.has(w.id)) ?? weeks[0];
    if (!week) { setError("This founder has no weeks to put a task in."); return; }
    const r = await fetch("/api/admin/ir/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, milestoneId: week.id, assigneeId: meId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't create the task."); return; }
    setAdding(false);
    await load();
    setOpenId(j.id);
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;

  const weekly = search.groupBy === "week";
  const staff = [...new Set(data.tasks.map((t) => t.assignee_name ?? "Unassigned"))].sort();
  const viewBtn = (on: boolean) => `px-2 py-1 ${on ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <NewButton onClick={() => setAdding((v) => !v)} />
        <span className="text-[16px] text-slate-800">All tasks</span>
        <ToolbarGear heading="Tasks" items={[
          { key: "import", icon: "ti-upload", label: "Odoo import", href: "/admin/ir/import" },
          { key: "projects", icon: "ti-folders", label: "Projects", href: "/admin/ir/projects" },
        ]} />
        <OdooSearchBar scope="ir.tasks" state={search} onChange={setSearch} quick={QUICK}
          fields={[{ key: "founder", label: "Founder", options: data.projects.map((p) => p.founder_name ?? p.title) }, { key: "assignee", label: "Assignee", options: staff }]}
          groups={GROUPS} noGroupId="founder_month" groupChipPrefix="Grouped by " placeholder="Search…" width={460} />
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200 text-[15px]" role="group" aria-label="View">
          <button type="button" aria-label="List view" aria-pressed={!weekly && view === "list"} onClick={() => { setView("list"); if (weekly) setSearch({ ...search, groupBy: "founder_month" }); }} className={viewBtn(!weekly && view === "list")}><i className="ti ti-list" aria-hidden="true" /></button>
          <button type="button" aria-label="Kanban view" aria-pressed={!weekly && view === "kanban"} onClick={() => { setView("kanban"); if (weekly) setSearch({ ...search, groupBy: "founder_month" }); }} className={viewBtn(!weekly && view === "kanban")}><i className="ti ti-layout-kanban" aria-hidden="true" /></button>
          <button type="button" aria-label="Weekly calendar view" aria-pressed={weekly} onClick={() => setSearch({ ...search, groupBy: "week" })} className={viewBtn(weekly)}><i className="ti ti-calendar" aria-hidden="true" /></button>
        </div>
      </div>

      {adding ? <NewTaskForm projects={data.projects} months={data.months} onCancel={() => setAdding(false)} onCreate={(p, m) => void createIn(p, m)} /> : null}
      {error ? <div role="alert" className="mb-2 flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}<button type="button" onClick={() => setError(null)} className="ml-auto" aria-label="Dismiss"><i className="ti ti-x" aria-hidden="true" /></button></div> : null}

      {weekly ? <AllFoundersBoard /> : (
        <>
          {view === "list" ? <ListView columns={columns} color={color} onOpen={setOpenId} /> : (
            <HScrollBoard>
              {columns.filter((c) => c.tasks.length > 0 || (dragId && canDrop(c))).map((c) => {
                const folded = !dragId && (fold[c.id] ?? false);
                const over = overCol === c.id && canDrop(c);
                const dnd = {
                  onDragOver: (e: React.DragEvent) => { if (canDrop(c)) { e.preventDefault(); setOverCol(c.id); } },
                  onDragLeave: () => setOverCol((o) => (o === c.id ? null : o)),
                  onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(c); },
                };
                if (folded) return (
                  <button key={c.id} type="button" {...dnd} onClick={() => toggleFold(c.id, true)} title={`Unfold ${c.label}`}
                    className={`flex min-h-[220px] flex-col items-center gap-2 rounded-lg px-1.5 py-2 text-slate-600 ${over ? "bg-indigo-100 ring-2 ring-indigo-400" : "bg-slate-50 hover:bg-slate-100"}`} style={{ flex: "0 0 36px" }}>
                    <i className="ti ti-chevrons-right text-slate-400" aria-hidden="true" />
                    <span className="text-[12px] font-medium" style={{ writingMode: "vertical-rl" }}>{c.label} ({c.tasks.length})</span>
                  </button>
                );
                const counts = (["planned", "today", "overdue", "done", "none"] as Due[]).map((d) => [d, c.tasks.filter((t) => dueOf(t) === d).length] as const);
                return (
                  <div key={c.id} {...dnd} style={{ flex: "0 0 260px", minWidth: 260 }} className={`rounded-lg px-1 pb-2 ${over ? "bg-indigo-50 ring-2 ring-indigo-300" : dragId && canDrop(c) ? "bg-slate-50 ring-1 ring-dashed ring-slate-300" : ""}`}>
                    <div className="group flex items-center gap-1 pt-1">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900" title={c.label}>{c.label}</span>
                      <button type="button" onClick={() => toggleFold(c.id, false)} aria-label={`Fold ${c.label}`} className="rounded px-1 text-slate-400 opacity-0 hover:bg-slate-100 group-hover:opacity-100 focus:opacity-100"><i className="ti ti-chevrons-left" aria-hidden="true" /></button>
                      <button type="button" onClick={() => void createIn(c.project_id, c.monthId)} aria-label={`Add task to ${c.label}`} className="rounded px-1 text-slate-500 hover:bg-slate-100"><i className="ti ti-plus" aria-hidden="true" /></button>
                    </div>
                    <div className="mb-2.5 mt-1.5 flex items-center gap-2">
                      <div className="flex h-2.5 flex-1 overflow-hidden bg-slate-200">
                        {counts.filter(([, n]) => n).map(([d, n]) => <div key={d} title={`${DUE_LABEL[d]}: ${n}`} style={{ width: `${(n / c.tasks.length) * 100}%`, background: DUE_COLOR[d] }} />)}
                      </div>
                      <span className="min-w-[14px] text-right text-[13px] font-medium tabular-nums text-slate-800">{c.tasks.length}</span>
                    </div>
                    <div className="flex min-h-[60px] flex-col gap-2">
                      {c.tasks.length === 0 ? <p className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-[12px] text-slate-400">Drop here</p> : null}
                      {c.tasks.map((t) => <Card key={t.id} t={t} draggable={grouping === "founder_month"}
                        onOpen={() => setOpenId(t.id)} onStar={() => void patchTask(t.id, { starred: !t.starred }, { starred: !t.starred })}
                        onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} dragging={dragId === t.id} />)}
                    </div>
                  </div>
                );
              })}
            </HScrollBoard>
          )}
        </>
      )}

      {openId ? <TaskSidePanel taskId={openId} onClose={() => setOpenId(null)}
        onChanged={(id, patch) => setData((d) => d && { ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })} /> : null}
    </div>
  );
}

function Card({ t, draggable, dragging, onOpen, onStar, onDragStart, onDragEnd }: { t: Task; draggable: boolean; dragging: boolean; onOpen: () => void; onStar: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const due = dueOf(t);
  const dueTitle = `${DUE_LABEL[due]}${t.deadline ? ` · ${fmtShort(t.deadline)}` : ""}`;
  return (
    <div role="button" tabIndex={0} aria-label={`Open ${t.title}`} draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); onDragStart(); }} onDragEnd={onDragEnd}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onOpen(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}
      className={`cursor-pointer rounded border border-slate-200 bg-white px-2.5 pb-2 pt-2.5 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${dragging ? "opacity-40" : ""}`}>
      <p className="text-[14px] text-slate-900">{t.title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {t.investor_names.map((n, i) => <span key={`${n}-${i}`} className="max-w-full truncate rounded-full bg-slate-100 px-2 py-px text-[11.5px] text-slate-700" title={n}>{n}</span>)}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={onStar} aria-label={t.starred ? "Remove priority" : "Mark as priority"} aria-pressed={t.starred} className="leading-none">
          <i className={`ti ${t.starred ? "ti-star-filled text-amber-500" : "ti-star text-slate-500 hover:text-amber-500"} text-[16px]`} aria-hidden="true" />
        </button>
        <i className="ti ti-clock text-[16px]" style={{ color: due === "none" || due === "done" ? "#475569" : DUE_COLOR[due] }} title={dueTitle} aria-label={dueTitle} />
        {t.assignee_name
          ? <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-white" title={t.assignee_name}>{initials(t.assignee_name)}</span>
          : <span className="ml-auto h-5 w-5 rounded-full border border-slate-300 bg-slate-100" title="Unassigned" />}
      </div>
    </div>
  );
}

function ListView({ columns, color, onOpen }: { columns: Column[]; color: Map<string, string>; onOpen: (id: string) => void }) {
  const groups = columns.filter((c) => c.tasks.length);
  if (!groups.length) return <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[12.5px] text-slate-400">No tasks match these filters.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-[12.5px]">
        <thead className="bg-slate-50 text-left text-[11.5px] text-slate-500"><tr><th className="px-3 py-2 font-medium">Task</th><th className="px-3 py-2 font-medium">Week</th><th className="px-3 py-2 font-medium">Investors</th><th className="px-3 py-2 font-medium">Deadline</th><th className="px-3 py-2 font-medium">Assignee</th></tr></thead>
        <tbody>
          {groups.map((c) => [
            <tr key={c.id} className="border-t border-slate-200 bg-slate-50/60"><td colSpan={5} className="px-3 py-1.5 font-semibold text-slate-700"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: color.get(c.project_id) }} />{c.label} <span className="font-normal text-slate-400">({c.tasks.length})</span></td></tr>,
            ...c.tasks.map((t) => {
              const due = dueOf(t);
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                  <td className="px-3 py-2 font-medium text-slate-900">{t.starred ? <i className="ti ti-star-filled mr-1 text-amber-500" aria-hidden="true" /> : null}{t.title}</td>
                  <td className="px-3 py-2 text-slate-600">{t.week?.label ?? ""}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{t.investors}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1" style={{ color: due === "overdue" ? "#DC2626" : undefined }}><i className="ti ti-clock" style={{ color: DUE_COLOR[due] }} aria-hidden="true" />{t.deadline ? fmtShort(t.deadline) : ""}</span></td>
                  <td className="px-3 py-2 text-slate-600">{t.assignee_name ?? "Unassigned"}</td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function NewTaskForm({ projects, months, onCancel, onCreate }: { projects: Project[]; months: Month[]; onCancel: () => void; onCreate: (projectId: string, monthId: string | null) => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const opts = months.filter((m) => m.project_id === projectId).sort((a, b) => a.sort_order - b.sort_order);
  const [monthId, setMonthId] = useState<string>("");
  const month = opts.some((m) => m.id === monthId) ? monthId : opts[0]?.id ?? "";
  const sel = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[12.5px] text-slate-600">
      <label>Founder <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`ml-1 ${sel}`}>{projects.map((p) => <option key={p.id} value={p.id}>{p.founder_name ?? p.title}</option>)}</select></label>
      <label>Month <select value={month} onChange={(e) => setMonthId(e.target.value)} className={`ml-1 ${sel}`}>{opts.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <span className="text-[11.5px] text-slate-400">Goes into the first free week of that month.</span>
      <button type="button" onClick={() => onCreate(projectId, month || null)} disabled={!projectId} className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Create task</button>
      <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-white">Cancel</button>
    </div>
  );
}
