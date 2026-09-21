"use client";

/**
 * Projects — one card per founder raise (Odoo card layout: star, title, date range, owner
 * tag, SPV tag, footer with task count / assignee / status dot). Card body opens the
 * pipeline; the task count opens the weekly Task board.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import type { IrProject } from "@/lib/ir/types";

type Counts = { matches: number; tasks: number; tasksDone: number; openActivities: number; lateActivities: number; meetingsHeld: number; termSheets: number };
type Payload = { projects: IrProject[]; counts: Record<string, Counts>; staff: Array<{ id: string; name: string }> };

const STATUS_DOT: Record<string, string> = { active: "#16A34A", paused: "#CA8A04", completed: "#2563EB", cancelled: "#94A3B8" };
const initials = (n: string | null) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function ProjectsClient({ meId }: { meId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("active");

  async function load() {
    const r = await fetch(`/api/admin/ir/projects${status ? `?status=${status}` : ""}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load projects."); return; }
    setData(j); setError(null);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const c = data?.counts[p.id];
          const mine = p.owner_id === meId;
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => star(p)} aria-label={p.starred ? "Unstar" : "Star"} className={`mt-0.5 ${p.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${p.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
                <Link href={`/admin/ir/projects/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900 hover:text-indigo-700">{p.title}</p>
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
                <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700" title={p.owner_name ?? ""}>{initials(p.owner_name)}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[p.status] ?? "#94A3B8" }} title={p.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
