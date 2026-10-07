"use client";

/**
 * Projects — one card per founder raise (Odoo card layout: star, title, date range, owner
 * tag, SPV tag, footer with task count / assignee / status dot). Card body opens the
 * pipeline; the task count opens the weekly Task board. The ⋮ menu (Odoo style) jumps to
 * Tasks, Milestones, Pipeline, Dashboard, Burndown, Founder report, Share, Duplicate and
 * Settings, sets the card colour, and stars it. Edit project opens a panel for the name,
 * founder, owner, status, SPV, founder visibility and description.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, DAYS_PER_MONTH, formatRange, TERM_OPTIONS } from "@/lib/ir/milestones";
import type { IrProject } from "@/lib/ir/types";
import { ActivityClock } from "../_shared/ActivityClock";

type Counts = { matches: number; tasks: number; tasksDone: number; openActivities: number; lateActivities: number; meetingsHeld: number; termSheets: number };
type Payload = { projects: IrProject[]; counts: Record<string, Counts>; staff: Array<{ id: string; name: string }> };

const STATUS_DOT: Record<string, string> = { active: "#16A34A", paused: "#CA8A04", completed: "#2563EB", cancelled: "#94A3B8" };
const COLORS: Array<string | null> = [null, "#E5484D", "#EA580C", "#CA8A04", "#16A34A", "#0F766E", "#2563EB", "#4F46E5", "#7C3AED", "#DB2777", "#64748B", "#0F172A"];
const mi = "-mx-2 block rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-indigo-700";
const initials = (n: string | null) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function ProjectsClient({ meId }: { meId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [menu, setMenu] = useState<string | null>(null);
  const [dupBusy, setDupBusy] = useState(false);
  const [edit, setEdit] = useState<null | { id: string; title: string; founderName: string; ownerId: string; status: string; isSpv: boolean; founderReportVisible: boolean; description: string; startDate: string; termMonths: number }>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  function openEdit(p: IrProject) {
    setMenu(null); setEditError(null);
    setEdit({ id: p.id, title: p.title, founderName: p.founder_name ?? "", ownerId: p.owner_id, status: p.status, isSpv: p.is_spv, founderReportVisible: p.founder_report_visible, description: p.description ?? "", startDate: p.start_date, termMonths: p.term_months });
  }
  async function saveEdit() {
    if (!edit) return;
    if (!edit.title.trim()) { setEditError("The project needs a name."); return; }
    setSaving(true); setEditError(null);
    const r = await fetch(`/api/admin/ir/projects/${edit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: edit.title.trim(), founderName: edit.founderName.trim() || null, ownerId: edit.ownerId, status: edit.status, isSpv: edit.isSpv, founderReportVisible: edit.founderReportVisible, description: edit.description.trim() || null, startDate: edit.startDate, termMonths: edit.termMonths }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setEditError(j.error ?? "Couldn't save the project."); return; }
    setEdit(null); void load();
  }
  useEffect(() => {
    if (!edit) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEdit(null); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [edit]);
  const router = useRouter();
  async function setColor(p: IrProject, color: string | null) {
    setMenu(null);
    const r = await fetch(`/api/admin/ir/projects/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(/color/i.test(j.error ?? "") ? "Card colours need migration 20260928110000_ir_project_color.sql run in Supabase." : j.error ?? "Couldn't set the colour."); return; }
    void load();
  }
  async function duplicate(p: IrProject) {
    setDupBusy(true);
    const r = await fetch(`/api/admin/ir/projects/${p.id}/duplicate`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setDupBusy(false); setMenu(null);
    if (!r.ok) { setError(j.error ?? "Couldn't duplicate the project."); return; }
    router.push(`/admin/ir/projects/${j.id}`);
  }
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-project-menu]")) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  async function load() {
    const r = await fetch(`/api/admin/ir/projects${status ? `?status=${status}` : ""}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load projects."); return; }
    setData(j); setError(null);
  }
  useEffect(() => { void load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function star(p: IrProject) {
    await fetch(`/api/admin/ir/projects/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: !p.starred }) });
    void load();
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = data?.projects ?? [];
    return t ? all.filter((p) => [p.title, p.founder_name, p.owner_name].some((s) => (s ?? "").toLowerCase().includes(t))) : all;
  }, [data, q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/admin/ir/projects/new" className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">New</Link>
        <span className="text-[15px] font-semibold text-slate-900">Projects</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search founder, company, owner…" className="ml-2 w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px] text-slate-700">
          <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="">All</option>
        </select>
        <span className="ml-auto text-[12px] text-slate-500">{rows.length ? `1-${rows.length} / ${(data?.projects ?? []).length}` : `0 / ${(data?.projects ?? []).length}`}</span>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      {!data && !error ? <p className="text-[13px] text-slate-400">Loading…</p> : null}
      {data && rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No {status || ""} projects. <Link href="/admin/ir/projects/new" className="text-indigo-600 hover:underline">Create the first one</Link> from a closed-won deal.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {rows.map((p) => {
          const c = data?.counts[p.id];
          const mine = p.owner_id === meId;
          return (
            <div key={p.id} className="group relative rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-md" style={p.color ? { borderLeft: `5px solid ${p.color}` } : undefined}>
              <div className="absolute right-2 top-2" data-project-menu>
                <button type="button" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label="Project menu" aria-haspopup="true" aria-expanded={menu === p.id}
                  title="Project menu" className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[18px] ${menu === p.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"}`}><i className="ti ti-dots-vertical" aria-hidden="true" /></button>
                {menu === p.id ? (
                  <div role="menu" className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 text-[12.5px] shadow-lg">
                    <button role="menuitem" type="button" onClick={() => openEdit(p)} className="mb-2 flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-2 text-left font-semibold text-indigo-800 hover:bg-indigo-100"><i className="ti ti-pencil" aria-hidden="true" /> Edit project</button>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-[12px] font-semibold text-slate-900">View</p>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}/tasks`} className={mi}>Tasks</Link>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}/milestones`} className={mi}>Milestones</Link>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}/pipeline`} className={mi}>Pipeline</Link>
                      </div>
                      <div>
                        <p className="mb-1 text-[12px] font-semibold text-slate-900">Reporting</p>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}?tab=analytics`} className={mi}>Dashboard</Link>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}/burndown`} className={mi}>Burndown chart</Link>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}/report`} className={mi}>Founder report</Link>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[auto_1fr] gap-3 border-t border-slate-100 pt-2">
                      <div className="grid grid-cols-4 content-start gap-1.5" role="group" aria-label="Card colour">
                        {COLORS.map((c) => (
                          <button key={c ?? "none"} type="button" onClick={() => void setColor(p, c)} aria-label={c ? `Colour ${c}` : "No colour"} aria-pressed={(p.color ?? null) === c}
                            className={`h-5 w-5 rounded border ${(p.color ?? null) === c ? "ring-2 ring-slate-800 ring-offset-1" : "border-slate-300"}`} style={{ background: c ?? "#fff" }}>
                            {c ? null : <i className="ti ti-slash text-[11px] text-slate-400" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                      <div className="border-l border-slate-100 pl-3">
                        <Link role="menuitem" href={`/admin/ir/matches?project=${p.id}`} className={mi}>Share Project</Link>
                        <button role="menuitem" type="button" disabled={dupBusy} onClick={() => void duplicate(p)} className={`${mi} w-[calc(100%+1rem)] text-left disabled:opacity-50`}>{dupBusy ? "Duplicating…" : "Duplicate"}</button>
                        <Link role="menuitem" href={`/admin/ir/projects/${p.id}?tab=settings`} className={mi}>Settings</Link>
                        <button role="menuitem" type="button" onClick={() => { setMenu(null); void star(p); }} className={`${mi} w-[calc(100%+1rem)] text-left`}>{p.starred ? "Remove from favorites" : "Add to favorites"}</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex items-start gap-2 pr-9">
                <button type="button" onClick={() => star(p)} aria-label={p.starred ? "Unstar" : "Star"} className={`mt-0.5 ${p.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${p.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
                <Link href={`/admin/ir/projects/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900 hover:text-indigo-700" title={p.title}>{p.title}</p>
                  {p.founder_name ? <p className="truncate text-[12px] text-slate-500">{p.founder_name}</p> : null}
                  <p className="mt-1 text-[11.5px] text-slate-500"><i className="ti ti-clock" aria-hidden="true" /> {formatRange(p.start_date, p.end_date)} · {p.term_months} mo</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${mine ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{p.owner_name ?? "—"}</span>
                    {p.is_spv ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-700">SPV</span> : null}
                    {c?.lateActivities ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-rose-700">{c.lateActivities} late</span> : null}
                  </div>
                </Link>
              </div>
              <Link href={`/admin/ir/projects/${p.id}/tasks`} className="mt-3 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[13px] font-semibold text-indigo-800 hover:bg-indigo-100">
                <span><i className="ti ti-checklist" aria-hidden="true" /> {c?.tasks ?? 0} task{(c?.tasks ?? 0) === 1 ? "" : "s"}</span>
                <span className="text-[11.5px] font-normal text-indigo-600">{c?.tasksDone ?? 0} done · open board →</span>
              </Link>
              <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-slate-500">
                <span><i className="ti ti-users" aria-hidden="true" /> {c?.matches ?? 0} matches</span>
                <span><i className="ti ti-calendar-check" aria-hidden="true" /> {c?.meetingsHeld ?? 0} held</span>
                <span className="ml-auto"><ActivityClock projectId={p.id} meId={meId} openCount={c?.openActivities ?? 0} lateCount={c?.lateActivities ?? 0} onChange={() => void load()} /></span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700" title={p.owner_name ?? ""}>{initials(p.owner_name)}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[p.status] ?? "#94A3B8" }} title={p.status} />
              </div>
            </div>
          );
        })}
      </div>
      {edit ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="edit-project-title" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }} className="mt-10 w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center">
              <h2 id="edit-project-title" className="text-[17px] font-semibold text-slate-900">Edit project</h2>
              <button type="button" onClick={() => setEdit(null)} aria-label="Close" className="ml-auto rounded-md px-2 py-0.5 text-[18px] text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <label className="col-span-2 flex flex-col gap-1"><span className="font-medium text-slate-700">Project name</span><input autoComplete="off" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={160} className="rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-400 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Founder</span><input autoComplete="off" value={edit.founderName} onChange={(e) => setEdit({ ...edit, founderName: e.target.value })} maxLength={160} className="rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-400 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Owner</span><select value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2">{(data?.staff ?? []).some((s) => s.id === edit.ownerId) ? null : <option value={edit.ownerId}>Current owner</option>}{(data?.staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Status</span><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
              <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Start date</span><input type="date" value={edit.startDate} onChange={(e) => e.target.value && setEdit({ ...edit, startDate: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-400 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Term</span><select value={edit.termMonths} onChange={(e) => setEdit({ ...edit, termMonths: Number(e.target.value) })} className="rounded-lg border border-slate-200 bg-white px-3 py-2">{TERM_OPTIONS.map((t) => <option key={t} value={t}>{t} months</option>)}</select></label>
              <p className="col-span-2 -mt-1 text-[12px] text-slate-500">Ends {formatRange(edit.startDate, addDays(edit.startDate, edit.termMonths * DAYS_PER_MONTH)).split(" to ")[1] ?? ""}. Changing the start or term moves the month and week milestones; tasks and activities keep their dates.</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={edit.isSpv} onChange={(e) => setEdit({ ...edit, isSpv: e.target.checked })} /> SPV</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={edit.founderReportVisible} onChange={(e) => setEdit({ ...edit, founderReportVisible: e.target.checked })} /> Founder can see reports</label>
              <label className="col-span-2 flex flex-col gap-1"><span className="font-medium text-slate-700">Description</span><textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="What this raise is, and anything the team should know" className="resize-y rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-400 focus:outline-none" /></label>
            </div>
            {editError ? <p role="alert" className="mt-3 text-[12.5px] text-rose-700">{editError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
