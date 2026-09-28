"use client";

/**
 * Tasks hub › "All founders" — every active project's weekly tasks on one board, four
 * calendar weeks at a time. Each founder gets a colour; the chips above filter founders
 * and the count reflects the filter. A card opens its task.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HScrollBoard } from "@/components/admin/HScrollBoard";

type Task = { id: string; project_id: string; title: string; status: "new" | "in_progress" | "done"; starred: boolean; deadline: string | null; created_at: string; assignee_name: string | null; week: { label: string; starts_on: string; ends_on: string } | null; investors: number };
type Project = { id: string; title: string; founder_name: string | null };

const COLORS = ["#4F46E5", "#EA580C", "#0D9488", "#DB2777", "#7C3AED", "#16A34A", "#0284C7", "#CA8A04"];
const STATUS_DOT: Record<string, string> = { new: "#94A3B8", in_progress: "#F59E0B", done: "#16A34A" };
const DAY = 86_400_000;
const initials = (n: string | null) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
/** Monday (UTC) of the week holding an ISO date. */
const monday = (iso: string) => { const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY); };
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDeadline = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

export function AllFoundersBoard() {
  const router = useRouter();
  const [data, setData] = useState<{ projects: Project[]; tasks: Task[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(-1); // first column, in weeks from this week

  useEffect(() => {
    let live = true;
    void fetch("/api/admin/ir/tasks").then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setError(j.error ?? "Couldn't load tasks."); else setData(j);
    });
    return () => { live = false; };
  }, []);

  const color = useMemo(() => new Map((data?.projects ?? []).map((p, i) => [p.id, COLORS[i % COLORS.length]])), [data]);
  const byProject = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.id, p])), [data]);
  const thisWeek = monday(new Date().toISOString());
  const columns = [0, 1, 2, 3].map((i) => new Date(thisWeek.getTime() + (offset + i) * 7 * DAY));
  const inView = (data?.tasks ?? []).filter((t) => !hidden.has(t.project_id));
  const colOf = (t: Task) => { const w = t.week ? monday(t.week.starts_on).getTime() : null; return columns.findIndex((c) => c.getTime() === w); };
  const shown = inView.filter((t) => colOf(t) >= 0);

  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const founders = new Set(shown.map((t) => t.project_id)).size;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {data.projects.map((p) => {
          const n = data.tasks.filter((t) => t.project_id === p.id && colOf(t) >= 0).length;
          const on = !hidden.has(p.id);
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => setHidden((h) => { const x = new Set(h); if (on) x.add(p.id); else x.delete(p.id); return x; })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-slate-200 bg-white text-slate-700" : "border-slate-100 bg-slate-50 text-slate-400"}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color.get(p.id), opacity: on ? 1 : 0.4 }} />{p.founder_name ?? p.title} <b className="tabular-nums">{n}</b>
            </button>
          );
        })}
        {hidden.size ? <button type="button" onClick={() => setHidden(new Set())} className="text-[12px] text-indigo-700 hover:underline">Show all</button> : null}
        <span className="ml-auto flex items-center gap-2 text-[12px] text-slate-600">
          <span>{shown.length} task{shown.length === 1 ? "" : "s"} across {founders} founder{founders === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Earlier week" className="rounded border border-slate-200 px-1.5 hover:bg-slate-50"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
          <button type="button" onClick={() => setOffset(-1)} className="rounded border border-slate-200 px-2 hover:bg-slate-50">This week</button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Later week" className="rounded border border-slate-200 px-1.5 hover:bg-slate-50"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
        </span>
      </div>
      <HScrollBoard>
        {columns.map((c, i) => {
          const tasks = inView.filter((t) => colOf(t) === i);
          const isNow = c.getTime() === thisWeek.getTime();
          return (
            <div key={c.toISOString()} style={{ flex: "0 0 270px", minWidth: 270 }} className="px-1">
              <div className={`mb-2.5 flex items-center justify-between border-b-2 pb-1.5 ${isNow ? "border-indigo-500" : "border-slate-200"}`}>
                <span className={`text-[14px] font-semibold ${isNow ? "text-indigo-800" : "text-slate-900"}`}>{isNow ? "This week" : `Week of ${fmt(c)}`}</span>
                <span className="text-[12px] text-slate-500">{fmt(c)} to {fmt(new Date(c.getTime() + 6 * DAY))} · <b className="text-slate-700">{tasks.length}</b></span>
              </div>
              <div className="flex min-h-[60px] flex-col gap-2">
                {tasks.map((t) => {
                  const p = byProject.get(t.project_id);
                  const href = `/admin/ir/projects/${t.project_id}/tasks/${t.id}`;
                  return (
                    <div key={t.id} role="link" tabIndex={0} aria-label={`Open ${t.title}`}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button")) router.push(href); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) router.push(href); }}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-indigo-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                      style={{ borderLeft: `4px solid ${color.get(t.project_id)}` }}>
                      <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><span className="h-2 w-2 rounded-sm" style={{ background: color.get(t.project_id) }} />{p?.founder_name ?? p?.title ?? "Project"}</p>
                      <Link href={href} className="block text-[13px] font-semibold text-slate-900 hover:text-indigo-700">{t.starred ? <i className="ti ti-star-filled mr-1 text-amber-500" aria-hidden="true" /> : null}{t.title}</Link>
                      <p className="mt-1 text-[11.5px] text-slate-500">{t.investors ? `${t.investors} investor${t.investors === 1 ? "" : "s"}` : "no investors yet"}{t.week ? ` · ${t.week.label}` : ""}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-500">
                        <span>{t.deadline ? fmtDeadline(t.deadline) : ""}</span>
                        <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[9px] font-semibold text-white" title={t.assignee_name ?? ""}>{initials(t.assignee_name)}</span>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[t.status] }} title={t.status} />
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-[12px] text-slate-400">No tasks</p> : null}
              </div>
            </div>
          );
        })}
      </HScrollBoard>
    </div>
  );
}
