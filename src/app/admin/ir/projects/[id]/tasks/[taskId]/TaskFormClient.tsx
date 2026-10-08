"use client";

/**
 * Task form — Odoo layout for one weekly batch: week status bar (click to move), single
 * column of fields, tabs (Agent field · Sub-tasks · Matching · Meetings), chatter below,
 * previous / next week pager. The Agent field composer picks an investor and writes a
 * dated activity — this replaces the free-text Agent Field from Odoo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OdooPager } from "@/components/admin/OdooPager";
import { formatRange } from "@/lib/ir/milestones";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, IR_STAGES, IR_STAGE_LABEL, type IrActivity, type IrActivityType, type IrBlocker, type IrMatch, type IrMilestone, type IrNote, type IrProject, type IrTask } from "@/lib/ir/types";
import type { EntrepreneurProfile } from "@/lib/ir/db";
import { BlockersPanel, EntrepreneurTab, MessageComposer } from "../../../../_shared/RecordPanels";
import type { OdooOpenActivity } from "@/lib/ir/odoo-open-activities";
import { InvestorContactDialog } from "../../../../_shared/InvestorContactDialog";
import { MatchBulkActions } from "./MatchBulkActions";
import { ActivityPopover } from "./ActivityPopover";
import { OdooProjectStage } from "../../../../_shared/OdooProjectStage";
import { TaskDeleteDialog, runTaskAction, type TaskAction } from "../TaskArchiveDelete";
import { platformInputToIso, toPlatformInput } from "@/lib/time/platform-input";

type Contact = { email: string | null; phone: string | null; country: string | null; membership: string | null };
type Payload = { task: IrTask; project: IrProject; entrepreneur: EntrepreneurProfile | null; contacts: Record<string, Contact>; weeks: IrMilestone[]; months: IrMilestone[]; matches: IrMatch[]; activities: IrActivity[]; notes: IrNote[]; staff: Array<{ id: string; name: string }>; siblings: Array<{ id: string; title: string; milestone_id: string }> };
type Tab = "agent" | "subtasks" | "blocked" | "extra" | "founder" | "matching" | "meetings";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";
const STAGE_LABEL: Record<IrTask["status"], string> = { new: "New", in_progress: "In progress", done: "Done" };
/** Matching tab columns (Odoo's contact columns first). Name is always shown; the choice is remembered in this browser. */
type MatchColKey = "firm" | "membership" | "phone" | "email" | "activities" | "country" | "stage" | "fit" | "source" | "assignee";
const MATCH_COLS: Array<{ key: MatchColKey; label: string; on: boolean }> = [
  { key: "firm", label: "Company name", on: true }, { key: "membership", label: "Membership", on: true }, { key: "phone", label: "Phone", on: true },
  { key: "email", label: "Email", on: true }, { key: "activities", label: "Activities", on: true }, { key: "country", label: "Country", on: true },
  { key: "stage", label: "Stage", on: false }, { key: "fit", label: "Fit tier", on: false }, { key: "source", label: "Data source", on: false }, { key: "assignee", label: "Assignee", on: false },
];
const MATCH_DEFAULT = MATCH_COLS.filter((c) => c.on).map((c) => c.key);
const MATCH_COLS_KEY = "ir.task.matching.columns";
/** Sortable Matching columns: Name plus every optional column. Click a header to sort, click again to reverse. */
type MatchSortKey = "name" | MatchColKey;

export function TaskFormClient({ taskId, meId, initialTab, added, sequenced = null }: { taskId: string; meId: string; initialTab: string | null; added: number; sequenced?: number | null }) {
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcols, setMcols] = useState<MatchColKey[]>(MATCH_DEFAULT);
  const [colsOpen, setColsOpen] = useState(false);
  const [contact, setContact] = useState<{ contactId: string; matchId: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [actPop, setActPop] = useState<{ matchId: string; el: HTMLElement } | null>(null);
  const closeActPop = useCallback(() => setActPop(null), []);
  const [sort, setSort] = useState<{ key: MatchSortKey; dir: 1 | -1 } | null>(null);
  useEffect(() => {
    let saved: MatchColKey[] | null = null;
    try { const v = JSON.parse(window.localStorage.getItem(MATCH_COLS_KEY) ?? "null"); if (Array.isArray(v)) saved = v.filter((k): k is MatchColKey => MATCH_COLS.some((c) => c.key === k)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the column choice after mount (localStorage isn't available during SSR)
    if (saved) setMcols(saved);
  }, []);
  useEffect(() => {
    if (!colsOpen) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-cols-menu]")) setColsOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setColsOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [colsOpen]);
  function setMatchCols(next: MatchColKey[]) { setMcols(next); try { window.localStorage.setItem(MATCH_COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ } }
  const [tab, setTab] = useState<Tab>((["agent", "subtasks", "blocked", "extra", "founder", "matching", "meetings"].includes(initialTab ?? "") ? initialTab : "agent") as Tab);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [stageMenu, setStageMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(added ? `${added} investor${added === 1 ? "" : "s"} added to this week.${sequenced != null ? ` ${sequenced} started on an auto sequence; the first emails go out within 15 minutes.` : ""}` : null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/tasks/${taskId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the task."); return; }
    setData(j); setError(null);
  }, [taskId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/ir/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "Couldn't update."); }
      await load();
    } finally { setBusy(false); }
  }
  async function removeMatch(m: IrMatch) {
    if (!window.confirm(`Remove ${m.investor_name ?? "this investor"} from ${p?.title ?? "the project"}? Their activities and stage history on this project go too.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/ir/matches/${m.id}`, { method: "DELETE" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "Couldn't remove."); }
      await load();
    } finally { setBusy(false); }
  }
  async function patchActivity(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/ir/activities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
  }

  // Open Odoo activities on the investors (read live; the import only brings completed history).
  const [odooActs, setOdooActs] = useState<Record<string, OdooOpenActivity[]>>({});
  const matchKey = (data?.matches ?? []).map((m) => m.id).join(",");
  const loadOdoo = useCallback(async () => {
    if (!matchKey) { setOdooActs({}); return; }
    const r = await fetch(`/api/admin/ir/odoo-activities?matchIds=${matchKey}`).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => ({})) : {};
    setOdooActs(j.byMatch ?? {});
  }, [matchKey]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void loadOdoo(); }, [loadOdoo]);
  const odooDueIso = (o: OdooOpenActivity) => (o.due ? new Date(`${o.due}T17:00:00`).toISOString() : "");

  const open = useMemo(() => (data?.activities ?? []).filter((a) => !a.done_at).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9")), [data]);
  const done = useMemo(() => (data?.activities ?? []).filter((a) => a.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")), [data]);
  const matchName = (id: string | null) => data?.matches.find((m) => m.id === id)?.investor_name ?? (id ? "Investor" : "Week");

  // This project's weekly tasks in week order (pager + milestone strip).
  const ordered = useMemo(() => {
    if (!data) return [];
    const rank = (mid: string) => data.weeks.find((w) => w.id === mid)?.sort_order ?? 0;
    return [...data.siblings].sort((a, b) => rank(a.milestone_id) - rank(b.milestone_id));
  }, [data]);
  // Odoo pager: Prev / Next wrap around at either end.
  const idx = data ? ordered.findIndex((s) => s.id === data.task.id) : -1;
  const n = ordered.length;
  const prev = idx >= 0 && n > 1 ? ordered[(idx - 1 + n) % n] : null;
  const next = idx >= 0 && n > 1 ? ordered[(idx + 1) % n] : null;
  const taskBase = data ? `/admin/ir/projects/${data.project.id}/tasks` : "";
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function archive(action: Exclude<TaskAction, "delete">) {
    setGearOpen(false); setBusy(true);
    try {
      const r = await runTaskAction([taskId], action);
      if (!r.ok) { setError(r.message); return; }
      setNotice(`Task ${action === "archive" ? "archived" : "unarchived"}.${r.message ? ` ${r.message}` : ""}`);
      await load();
    } finally { setBusy(false); }
  }
  // Odoo keyboard shortcuts: Alt+P previous record, Alt+N next record.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const to = e.code === "KeyN" ? next : e.code === "KeyP" ? prev : null;
      if (!to) return;
      e.preventDefault();
      router.push(`${taskBase}/${to.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, taskBase, router]);

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const { task: t, project: p } = data;
  const week = data.weeks.find((w) => w.id === t.milestone_id) ?? null;
  const month = data.months.find((m) => m.id === week?.parent_id) ?? null;
  const base = taskBase;
  const monthWeeks = data.weeks.filter((w) => w.parent_id === week?.parent_id);
  // Odoo-style milestone strip (top right): up to 4 weekly tasks, current one first where possible,
  // then the weeks that follow. Earlier weeks collapse into "+N", later ones into "+N more".
  const CHAIN_MAX = 4;
  const chainStart = idx >= 0 ? Math.max(0, Math.min(idx, n - CHAIN_MAX)) : 0;
  const chain = idx >= 0 ? ordered.slice(chainStart, chainStart + CHAIN_MAX) : [];
  const chainHidden = chainStart;
  const chainLater = idx >= 0 ? ordered.slice(chainStart + CHAIN_MAX) : [];
  const monthNo = week ? [...data.months].sort((a, b) => a.sort_order - b.sort_order).findIndex((m) => m.id === week.parent_id) + 1 : 0;
  const chevron = (first: boolean) => ({ clipPath: first ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" });

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${p.id}`} className="hover:text-indigo-700">{p.title}</Link><span>/</span>
        <Link href={base} className="hover:text-indigo-700">Tasks</Link><span>/</span><span className="text-slate-800">{t.title}</span>
        <span className="relative">
          <button type="button" onClick={() => setGearOpen((v) => !v)} aria-label="Task actions" aria-expanded={gearOpen} disabled={busy} className="rounded p-0.5 text-[14px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"><i className="ti ti-settings" aria-hidden="true" /></button>
          {gearOpen ? <>
            <div className="fixed inset-0 z-20" onClick={() => setGearOpen(false)} />
            <div className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-[12.5px] shadow-lg">
              {t.archived_at
                ? <button type="button" onClick={() => void archive("unarchive")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"><i className="ti ti-archive-off text-slate-400" aria-hidden="true" />Unarchive</button>
                : <button type="button" onClick={() => void archive("archive")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"><i className="ti ti-archive text-slate-400" aria-hidden="true" />Archive</button>}
              <div className="my-1 border-t border-slate-100" />
              <button type="button" onClick={() => { setGearOpen(false); setDeleting(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-700 hover:bg-rose-50"><i className="ti ti-trash" aria-hidden="true" />Delete</button>
            </div>
          </> : null}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <OdooPager label={`${idx + 1} / ${n}`}
            prev={{ href: prev ? `${base}/${prev.id}` : undefined, title: prev ? `${prev.title} (Alt+P)` : undefined }}
            next={{ href: next ? `${base}/${next.id}` : undefined, title: next ? `${next.title} (Alt+N)` : undefined }} />
        </span>
      </div>
      {/* Odoo project stage and status, click a step to move the project in Odoo */}
      <OdooProjectStage projectId={p.id} className="mb-3" />
      {/* Stage: big chevron bar, click a step to move; ▾ menu to pick or edit */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
        <OdooStageBar size="lg" steps={(["new", "in_progress", "done"] as const).map((st) => ({ key: st, label: STAGE_LABEL[st] }))} current={t.status} onSelect={(st) => void patch({ status: st as typeof t.status })} disabled={busy} />
        <div className="relative">
          <button type="button" onClick={() => setStageMenu((v) => !v)} aria-label="Edit stage" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">▾</button>
          {stageMenu ? <>
            <div className="fixed inset-0 z-20" onClick={() => setStageMenu(false)} />
            <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white text-[12.5px] shadow-lg">
              {(["new", "in_progress", "done"] as const).map((st) => <button key={st} type="button" onClick={() => { setStageMenu(false); if (t.status !== st) void patch({ status: st }); }} className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${t.status === st ? "font-medium text-indigo-700" : "text-slate-700"}`}>{STAGE_LABEL[st]}{t.status === st ? " ✓" : ""}</button>)}
              {monthWeeks.length ? <div className="border-t border-slate-100 py-1">
                <p className="px-3 pb-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Move to week</p>
                {monthWeeks.map((w) => { const active = w.id === t.milestone_id; return <button key={w.id} type="button" disabled={busy || active} onClick={() => { setStageMenu(false); void patch({ milestoneId: w.id, deadline: w.ends_on }); }} title={formatRange(w.starts_on, w.ends_on)} className={`block w-full px-3 py-1.5 text-left hover:bg-slate-50 ${active ? "font-medium text-indigo-700" : "text-slate-700"}`}>{w.label}{active ? " ✓" : ""}</button>; })}
              </div> : null}
              <div className="border-t border-slate-100 px-3 py-2 text-[11.5px] text-slate-400">Stages are New → In progress → Done. Move to week changes the week this task sits in.</div>
            </div>
          </> : null}
        </div>
        </div>
        {chain.length ? (
          <nav aria-label="Task chain" className="flex max-w-full flex-wrap">
            {chainHidden ? <Link href={`${base}?month=${week?.parent_id ?? ""}`} title={`${chainHidden} earlier task${chainHidden === 1 ? "" : "s"} on the board`} className="bg-slate-100 px-4 py-2 text-[12.5px] text-slate-600 hover:bg-slate-200" style={chevron(true)}>+{chainHidden}</Link> : null}
            {chain.map((s, i) => {
              const cur = s.id === t.id; const w = data.weeks.find((x) => x.id === s.milestone_id);
              const cls = `-ml-1.5 max-w-[240px] truncate whitespace-nowrap px-5 py-2 text-[12.5px] ${i === 0 && !chainHidden ? "ml-0" : ""}`;
              return cur
                ? <span key={s.id} aria-current="page" title={w ? formatRange(w.starts_on, w.ends_on) : undefined} className={`${cls} bg-indigo-50 font-semibold text-indigo-800`} style={chevron(i === 0 && !chainHidden)}>{s.title}{monthNo ? <span className="ml-1.5 text-[11px] font-normal text-indigo-500">{monthNo}M</span> : null}</span>
                : <Link key={s.id} href={`${base}/${s.id}`} title={w ? `${s.title} · ${formatRange(w.starts_on, w.ends_on)}` : s.title} className={`${cls} bg-slate-100 text-slate-700 hover:bg-slate-200`} style={chevron(i === 0 && !chainHidden)}>{s.title}</Link>;
            })}
            {chainLater.length ? (
              <span className="relative -ml-1.5">
                <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} title={`${chainLater.length} later task${chainLater.length === 1 ? "" : "s"}`} className="whitespace-nowrap bg-slate-100 py-2 pl-5 pr-4 text-[12.5px] text-slate-600 hover:bg-slate-200" style={chevron(false)}>+{chainLater.length} more</button>
                {moreOpen ? <>
                  <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-[12.5px] shadow-lg">
                    {chainLater.map((s) => { const w = data.weeks.find((x) => x.id === s.milestone_id); return <Link key={s.id} href={`${base}/${s.id}`} onClick={() => setMoreOpen(false)} className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50">{s.title}{w ? <span className="block text-[11px] text-slate-400">{formatRange(w.starts_on, w.ends_on)}</span> : null}</Link>; })}
                  </div>
                </> : null}
              </span>
            ) : null}
          </nav>
        ) : null}
      </div>
      {t.archived_at ? <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800"><i className="ti ti-archive" aria-hidden="true" />This task is archived. It&apos;s hidden from the task boards.<button type="button" disabled={busy} onClick={() => void archive("unarchive")} className="ml-1 font-medium underline hover:text-amber-950">Unarchive</button></div> : null}
      {deleting ? <TaskDeleteDialog ids={[t.id]} label={t.title} onClose={() => setDeleting(false)} onDone={(action, message) => { setDeleting(false); if (action === "delete") router.push(base); else { setNotice(`Task archived.${message ? ` ${message}` : ""}`); void load(); } }} /> : null}
      {notice ? <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><i className="ti ti-circle-check" aria-hidden="true" /><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-emerald-800"><i className="ti ti-x" aria-hidden="true" /></button></div> : null}
      {error ? <p className="mb-2 text-[12px] text-rose-600">{error}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start gap-2 border-b border-slate-100 p-4">
          <button type="button" onClick={() => patch({ starred: !t.starred })} aria-label="Star" className={`mt-1 text-[18px] ${t.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${t.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
          <input value={title ?? t.title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title != null && title.trim() && title !== t.title) void patch({ title: title.trim() }); setTitle(null); }}
            className="flex-1 rounded-md border border-transparent px-2 py-1 text-[22px] font-semibold text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:outline-none" />
        </div>
        <div className="grid gap-x-8 gap-y-1 p-4 text-[12.5px] sm:grid-cols-2">
          <Field label="Project"><Link href={`/admin/ir/projects/${p.id}`} className="text-indigo-700 hover:underline">{p.title}</Link></Field>
          <Field label="Milestone">{month?.label ?? "—"} · {week?.label ?? "—"}{week ? ` · ${formatRange(week.starts_on, week.ends_on)}` : ""}</Field>
          <Field label="Matching">{data.matches.length} investor{data.matches.length === 1 ? "" : "s"} this week</Field>
          <Field label="Assignee">
            <select value={t.assignee_id ?? ""} disabled={busy} onChange={(e) => patch({ assigneeId: e.target.value || null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px]"><option value="">Unassigned</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
          </Field>
          <Field label="Deadline"><input type="date" value={t.deadline ?? ""} disabled={busy} onChange={(e) => patch({ deadline: e.target.value || null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px]" /></Field>
          <Field label="Open activities">{open.length}</Field>
        </div>

        <div className="flex gap-1 border-t border-slate-100 px-4">
          {([["agent", "Agent field"], ["subtasks", `Sub-tasks · ${data.activities.length}`], ["blocked", `Blocked by${(data.task.blockers ?? []).filter((b) => !b.cleared_at).length ? ` · ${(data.task.blockers ?? []).filter((b) => !b.cleared_at).length}` : ""}`], ["extra", "Extra info"], ["founder", "Entrepreneur profile"], ["matching", `Matching · ${data.matches.length}`], ["meetings", `Meetings · ${data.activities.filter((a) => a.type === "meeting").length}`]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <div className="p-4">
          {tab === "agent" ? <AgentField projectId={p.id} taskId={t.id} matches={data.matches} done={done} meId={meId} onChange={load} /> : null}
          {tab === "subtasks" ? (
            data.activities.length === 0 ? <p className="text-[12.5px] text-slate-400">No activities this week yet.</p> : (
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 pr-2 font-medium">Investor</th><th className="py-1 pr-2 font-medium">Activity</th><th className="py-1 pr-2 font-medium">When</th><th className="py-1 font-medium"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{[...open, ...done].map((a) => (
                  <tr key={a.id}><td className="py-1.5 pr-2">{a.match_id ? <Link href={`/admin/ir/matches/${a.match_id}`} className="text-indigo-700 hover:underline">{matchName(a.match_id)}</Link> : <span className="text-slate-500">Week</span>}</td>
                    <td className="py-1.5 pr-2"><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> {a.subject}{a.outcome ? <span className="text-slate-500"> — {a.outcome}</span> : null}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{a.done_at ? `done ${fmt(a.done_at)}` : a.due_at ? `due ${fmt(a.due_at)}` : "open"}</td>
                    <td className="py-1.5 text-right">{!a.done_at ? <button type="button" onClick={() => patchActivity(a.id, { done: true })} className="text-[11.5px] text-emerald-700 hover:underline">Mark done</button> : null}</td></tr>
                ))}</tbody></table>
            )
          ) : null}
          {tab === "matching" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] text-slate-500">Investors matched in this week. The queue opens in this week&rsquo;s context so new matches land here.</p>
                <Link href={`${base}/${t.id}/matching`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Add investors from matching queue</Link>
              </div>
              <div className="mb-2 flex justify-end">
                <div className="relative" data-cols-menu>
                  <button type="button" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} aria-haspopup="true" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"><i className="ti ti-columns" aria-hidden="true" /> Columns <span className="text-slate-400">{mcols.length}/{MATCH_COLS.length}</span></button>
                  {colsOpen ? (
                    <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Show columns</p>
                      <label className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-slate-400"><input type="checkbox" checked disabled /> Name <span className="ml-auto text-[10.5px]">Always on</span></label>
                      {MATCH_COLS.map((c) => <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={mcols.includes(c.key)} onChange={(e) => setMatchCols(e.target.checked ? MATCH_COLS.filter((x) => x.key === c.key || mcols.includes(x.key)).map((x) => x.key) : mcols.filter((k) => k !== c.key))} /> {c.label}</label>)}
                      <div className="mt-1 flex justify-between border-t border-slate-100 px-2 pt-2 text-[12px]"><button type="button" onClick={() => setMatchCols(MATCH_DEFAULT)} className="text-indigo-700 hover:underline">Reset to default</button><button type="button" onClick={() => setMatchCols(MATCH_COLS.map((c) => c.key))} className="text-indigo-700 hover:underline">Show all</button></div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="relative z-10 mb-2">
                <MatchBulkActions matches={data.matches} contacts={data.contacts} project={p} entrepreneur={data.entrepreneur} staff={data.staff} selected={picked} setSelected={setPicked} onChange={load} />
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="w-8 py-1.5 pl-1 pr-2">{(() => {
                const n = data.matches.filter((m) => picked.has(m.id)).length;
                const all = data.matches.length > 0 && n === data.matches.length;
                return <input type="checkbox" checked={all} disabled={!data.matches.length} ref={(el) => { if (el) el.indeterminate = n > 0 && !all; }} onChange={(e) => setPicked(e.target.checked ? new Set(data.matches.map((m) => m.id)) : new Set())} aria-label={all ? "Unselect all" : "Select all"} title={all ? "Unselect all" : "Select all"} />;
              })()}</th>{(["name", ...mcols] as MatchSortKey[]).map((k) => {
                const on = sort?.key === k;
                return <th key={k} aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className="p-0 pr-1 font-medium">
                  <button type="button" onClick={() => setSort(on ? { key: k, dir: sort!.dir === 1 ? -1 : 1 } : { key: k, dir: 1 })} title={`Sort by ${k === "name" ? "name" : MATCH_COLS.find((c) => c.key === k)?.label.toLowerCase()}`}
                    className={`flex w-full items-center gap-1 whitespace-nowrap rounded px-1.5 py-1.5 text-left hover:bg-slate-50 ${on ? "bg-indigo-50/60 text-slate-800 ring-1 ring-inset ring-indigo-400" : ""}`}>
                    {k === "name" ? "Name" : MATCH_COLS.find((c) => c.key === k)?.label}{on ? <i className={`ti ${sort!.dir === 1 ? "ti-chevron-up" : "ti-chevron-down"} ml-auto`} aria-hidden="true" /> : null}
                  </button></th>;
              })}<th className="py-1.5 font-medium"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{(() => {
                  if (!sort) return data.matches;
                  const val = (m: IrMatch): string | number => {
                    const c = data.contacts[m.investor_contact_id];
                    switch (sort.key) {
                      case "name": return (m.investor_name ?? m.investor_firm ?? "").toLowerCase();
                      case "firm": return (m.investor_firm ?? "").toLowerCase();
                      case "membership": return (c?.membership ?? "Investor").toLowerCase();
                      case "phone": return c?.phone ?? "";
                      case "email": return (c?.email ?? "").toLowerCase();
                      case "activities": return [open.find((a) => a.match_id === m.id)?.due_at ?? "", ...(odooActs[m.id] ?? []).map(odooDueIso)].filter(Boolean).sort()[0] ?? "";
                      case "country": return (c?.country ?? "").toLowerCase();
                      case "stage": return IR_STAGES.indexOf(m.stage);
                      case "fit": return m.fit_tier ?? "";
                      case "source": return m.data_source ?? "";
                      case "assignee": return (m.assignee_name ?? "").toLowerCase();
                    }
                  };
                  // Blanks sort last in both directions, like Odoo.
                  return [...data.matches].sort((a, b) => { const x = val(a), y = val(b); if (x === "" && y !== "") return 1; if (y === "" && x !== "") return -1; return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
                })().map((m) => {
                  const c = data.contacts[m.investor_contact_id];
                  const nx = open.find((a) => a.match_id === m.id);
                  const last = done.find((a) => a.match_id === m.id);
                  const late = nx?.due_at ? nx.due_at < new Date(now).toISOString() : false;
                  const ox = odooActs[m.id] ?? [];
                  // The Odoo activity leads the cell when it is due before the iCapOS one (or there is none).
                  const oFirst = ox[0] && (!nx?.due_at || (odooDueIso(ox[0]) && odooDueIso(ox[0]) < nx.due_at)) ? ox[0] : null;
                  const oLate = oFirst ? !!oFirst.due && odooDueIso(oFirst) < new Date(now).toISOString() : false;
                  const openCount = open.filter((a) => a.match_id === m.id).length + ox.length;
                  const cellOf = (k: MatchColKey) => {
                    switch (k) {
                      case "firm": return m.investor_firm ?? "—";
                      case "membership": return c?.membership ?? "Investor";
                      case "phone": return c?.phone ?? "—";
                      case "email": return <span className="block max-w-[220px] truncate" title={c?.email ?? ""}>{c?.email ?? "—"}</span>;
                      case "activities": return <button type="button" onClick={(e) => { e.stopPropagation(); const el = e.currentTarget; setActPop((cur) => (cur?.matchId === m.id ? null : { matchId: m.id, el })); }} aria-haspopup="dialog" aria-expanded={actPop?.matchId === m.id} title="See or schedule activities"
                        className={`-mx-1 rounded px-1 py-0.5 text-left hover:bg-indigo-50 ${actPop?.matchId === m.id ? "bg-indigo-50" : ""}`}>{oFirst ? <span className={`inline-flex items-center gap-1 ${oLate ? "text-rose-700" : "text-slate-700"}`}><i className="ti ti-calendar-event" aria-hidden="true" />{oFirst.summary}{oFirst.due ? <span className="text-slate-400"> · {oLate ? "overdue" : "due"} {new Date(odooDueIso(oFirst)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> : null}</span>
                        : nx ? <span className={`inline-flex items-center gap-1 ${late ? "text-rose-700" : "text-slate-700"}`}><i className={`ti ${IR_ACTIVITY_ICON[nx.type]}`} aria-hidden="true" />{nx.subject}{nx.due_at ? <span className="text-slate-400"> · {late ? "overdue" : "due"} {fmt(nx.due_at)}</span> : null}</span>
                        : last ? <span className="inline-flex items-center gap-1 text-emerald-700"><i className="ti ti-check" aria-hidden="true" />{last.subject}{last.done_at ? <span className="text-slate-400"> · {fmt(last.done_at)}</span> : null}</span>
                        : <span className="inline-flex items-center gap-1 text-slate-400"><i className="ti ti-clock" aria-hidden="true" />{IR_STAGE_LABEL[m.stage]}</span>}{openCount > 1 ? <span className="ml-1 rounded-full bg-indigo-50 px-1.5 text-[10.5px] font-medium text-indigo-700">+{openCount - 1}</span> : null}</button>;
                      case "country": return c?.country ?? "—";
                      case "stage": return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span>;
                      case "fit": return m.fit_tier ? `${m.fit_tier[0].toUpperCase()}${m.fit_tier.slice(1)}` : "—";
                      case "source": return m.data_source === "verified" ? "Verified" : m.data_source === "self_reported" ? "Self-reported" : "Unverified";
                      case "assignee": return m.assignee_name ?? "—";
                    }
                  };
                  return (
                    <tr key={m.id} onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, select, label")) return; setContact({ contactId: m.investor_contact_id, matchId: m.id }); }} className={`cursor-pointer ${picked.has(m.id) ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}>
                      <td className="py-2 pl-1 pr-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.has(m.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n; })} aria-label={`Select ${m.investor_name ?? m.investor_firm ?? "investor"}`} /></td>
                      <td className="whitespace-nowrap py-2 pr-2"><button type="button" onClick={() => setContact({ contactId: m.investor_contact_id, matchId: m.id })} className="text-left font-medium text-slate-900 hover:text-indigo-700 hover:underline">{m.investor_name ?? m.investor_firm ?? "—"}</button></td>
                      {mcols.map((k) => <td key={k} className="whitespace-nowrap py-2 pr-2 text-slate-600">{cellOf(k)}</td>)}
                      <td className="py-2 text-right"><button type="button" disabled={busy} onClick={() => removeMatch(m)} aria-label={`Remove ${m.investor_name ?? "investor"}`} className="text-slate-400 hover:text-rose-600">✕</button></td>
                    </tr>
                  ); })}
                  <tr><td colSpan={mcols.length + 3} className="py-2"><Link href={`${base}/${t.id}/matching`} className="text-[12.5px] text-indigo-700 hover:underline">Add a line</Link></td></tr>
                </tbody></table>
              </div>
              {actPop ? (() => { const m = data.matches.find((x) => x.id === actPop.matchId); return m ? <ActivityPopover anchor={actPop.el} activities={open.filter((a) => a.match_id === m.id)} projectId={p.id} taskId={t.id} matchId={m.id} staff={data.staff} meId={meId} now={now} onChange={load} onClose={closeActPop} odoo={odooActs[m.id] ?? []} history={done.filter((a) => a.match_id === m.id)} onOdooChange={loadOdoo} /> : null; })() : null}
              {contact ? <InvestorContactDialog contactId={contact.contactId} matchId={contact.matchId} onClose={() => setContact(null)} /> : null}
            </div>
          ) : null}
          {tab === "blocked" ? <BlockersPanel blockers={data.task.blockers ?? []} dealTitle={data.project.title} busy={busy} onChange={(next: IrBlocker[]) => patch({ blockers: next })} /> : null}
          {tab === "extra" ? <ExtraInfo task={data.task} week={week ?? null} investors={data.matches.length} linked={data.activities.length} busy={busy} onSave={(notes) => patch({ notes })} /> : null}
          {tab === "founder" ? <EntrepreneurTab e={data.entrepreneur} onSaved={load} /> : null}
          {tab === "meetings" ? (
            (() => { const ms = data.activities.filter((a) => a.type === "meeting"); return ms.length === 0 ? <p className="text-[12.5px] text-slate-400">No meetings this week.</p> : (
              <ul className="divide-y divide-slate-100 text-[12.5px]">{ms.map((a) => <li key={a.id} className="flex gap-2 py-1.5"><span className="font-medium text-slate-900">{matchName(a.match_id)}</span><span className="flex-1 text-slate-600">{a.subject}</span><span className="text-slate-500">{a.done_at ? `held ${fmt(a.done_at)}` : `booked ${fmt(a.due_at)}`}</span></li>)}</ul>); })()
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-4 py-3 text-[12.5px]">
          {month ? <span className="text-slate-500">{week?.label ? `${week.label} · ` : ""}{month.label} of {data.months.length}</span> : null}
          <Link href={`${base}?month=${week?.parent_id ?? ""}`} className="ml-auto text-indigo-700 hover:underline">Open board</Link>
        </div>
      </div>

      {/* Chatter: message to followers, planned across the week's investors, then the log */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Send message</p><MessageComposer endpoint={`/api/admin/ir/tasks/${taskId}`} onSent={load} /></div>
        {open.length ? <div className="border-b border-slate-100 px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Planned activities</p>
          <ul className="divide-y divide-slate-100 text-[12.5px]">{open.map((a) => <li key={a.id} className="flex items-center gap-2 py-1.5"><input type="checkbox" onChange={() => patchActivity(a.id, { done: true })} aria-label="Mark done" /><span className="font-medium text-slate-900">{matchName(a.match_id)}</span><span className="flex-1 text-slate-700">{a.subject}</span><span className={`text-[11px] ${a.due_at && new Date(a.due_at).getTime() < now ? "text-rose-600" : "text-slate-500"}`}>{a.due_at ? `due ${fmt(a.due_at)}` : ""}</span></li>)}</ul></div> : null}
        <div className="px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Log</p>
          {done.length === 0 && data.notes.length === 0 ? <p className="text-[12.5px] text-slate-400">Nothing logged yet.</p> : (
            <ul className="divide-y divide-slate-100 text-[12.5px]">
              {[...done.map((a) => ({ at: a.done_at!, node: <><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> <span className="font-medium text-slate-900">{matchName(a.match_id)}</span> · {a.subject}{a.outcome ? <span className="text-slate-500"> — {a.outcome}</span> : null}</>, who: a.created_by_name })),
                ...data.notes.map((n) => ({ at: n.created_at, node: <><i className={`ti ${n.body.startsWith("Message · ") ? "ti-message-circle text-indigo-500" : "ti-note text-amber-500"}`} aria-hidden="true" /> {n.body.startsWith("Message · ") ? n.body.slice(10) : n.body}</>, who: n.created_by_name }))]
                .sort((x, y) => y.at.localeCompare(x.at)).map((row, i) => <li key={i} className="flex gap-2 py-1.5"><span className="min-w-0 flex-1">{row.node}</span><span className="shrink-0 text-[11px] text-slate-500">{fmt(row.at)} · {row.who ?? "staff"}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ExtraInfo({ task, week, investors, linked, busy, onSave }: { task: IrTask; week: IrMilestone | null; investors: number; linked: number; busy: boolean; onSave: (notes: string | null) => Promise<void> }) {
  const [notes, setNotes] = useState(task.notes ?? "");
  const dirty = notes !== (task.notes ?? "");
  return (
    <div>
      <div className="grid gap-x-8 gap-y-0 text-[12.5px] sm:grid-cols-2">
        <Field label="Week range">{week ? `${week.label} · ${formatRange(week.starts_on, week.ends_on)}` : "—"}</Field>
        <Field label="Created">{new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Field>
        <Field label="Investors">{investors}</Field>
        <Field label="Linked records">{linked}</Field>
      </div>
      <label className="mt-3 block text-[12px] text-slate-600">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Anything the team should know about this week" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" /></label>
      <div className="mt-2 flex justify-end"><button type="button" disabled={busy || !dirty} onClick={() => onSave(notes.trim() || null)} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save notes</button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-3 py-1"><span className="w-32 shrink-0 text-slate-500">{label}</span><span className="min-w-0 flex-1 text-slate-800">{children}</span></div>;
}

/** Per-investor log entries plus a composer that picks the investor and writes a dated activity. */
function AgentField({ projectId, taskId, matches, done, meId, onChange }: { projectId: string; taskId: string; matches: IrMatch[]; done: IrActivity[]; meId: string; onChange: () => Promise<void> }) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [type, setType] = useState<IrActivityType>("call");
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("");
  const [when, setWhen] = useState(() => toPlatformInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!matchId && matches[0]) setMatchId(matches[0].id); }, [matches, matchId]); // eslint-disable-line react-hooks/set-state-in-effect

  async function log() {
    if (!subject.trim()) { setErr("Say what happened."); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/ir/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId, matchId: matchId || null, type, subject: subject.trim(), outcome: outcome.trim() || null, done: true, doneAt: when ? platformInputToIso(when) : null, assigneeId: meId }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "Couldn't log."); return; }
    setSubject(""); setOutcome("");
    await onChange();
  }
  const byMatch = new Map<string | null, IrActivity[]>();
  for (const a of done) byMatch.set(a.match_id, [...(byMatch.get(a.match_id) ?? []), a]);

  return (
    <div>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_130px_1fr]">
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inp}><option value="">Week (no investor)</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.investor_name ?? "Investor"}{m.investor_firm ? ` · ${m.investor_firm}` : ""}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value as IrActivityType)} className={inp}>{IR_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{IR_ACTIVITY_LABEL[t]}</option>)}</select>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What happened — e.g. Called, no answer (1st call)" className={`${inp} sm:col-span-2`} onKeyDown={(e) => { if (e.key === "Enter") void log(); }} />
        <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome (optional)" className={inp} />
        <div className="flex items-center gap-2 sm:col-span-3">{err ? <span className="text-[12px] text-rose-600">{err}</span> : null}<button type="button" disabled={busy} onClick={log} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Logging…" : "Log entry"}</button></div>
      </div>
      <div className="mt-3 space-y-3">
        {matches.map((m) => {
          const rows = byMatch.get(m.id) ?? [];
          return (
            <div key={m.id}>
              <p className="text-[12.5px] font-medium text-slate-900"><Link href={`/admin/ir/matches/${m.id}`} className="hover:text-indigo-700">{m.investor_name ?? "Investor"}</Link> <span className="text-slate-500">{m.investor_firm ?? ""}</span> <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span></p>
              {rows.length === 0 ? <p className="text-[11.5px] text-slate-400">No entries yet.</p> : <ul className="mt-0.5 text-[12px] text-slate-700">{rows.map((a) => <li key={a.id}><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> {a.subject}{a.outcome ? ` — ${a.outcome}` : ""} <span className="text-slate-400">{fmt(a.done_at)}</span></li>)}</ul>}
            </div>
          );
        })}
        {byMatch.get(null)?.length ? <div><p className="text-[12.5px] font-medium text-slate-900">Week</p><ul className="text-[12px] text-slate-700">{byMatch.get(null)!.map((a) => <li key={a.id}>{a.subject} <span className="text-slate-400">{fmt(a.done_at)}</span></li>)}</ul></div> : null}
        {matches.length === 0 ? <p className="text-[12.5px] text-slate-400">Add investors from the Matching tab to start logging against them.</p> : null}
      </div>
    </div>
  );
}
