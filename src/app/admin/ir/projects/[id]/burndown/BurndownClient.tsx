"use client";

/**
 * Project › Burndown — open to-dos (activities) at the end of each week across the term,
 * against an ideal line to zero at the project's end. Hover a week for its numbers.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { BurndownPoint } from "@/lib/ir/burndown";

type Payload = { project: { id: string; title: string; start_date: string; end_date: string }; points: BurndownPoint[]; openNow: number; total: number };
const W = 720, H = 280, M = { l: 40, r: 16, t: 14, b: 30 };
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function BurndownClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(`/api/admin/ir/projects/${projectId}/burndown`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setError(j.error ?? "Couldn't load the burndown."); else setData(j);
    });
    return () => { live = false; };
  }, [projectId]);

  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const pts = data.points;
  const max = Math.max(1, ...pts.map((p) => Math.max(p.open ?? 0, p.ideal)));
  const cw = W - M.l - M.r, ch = H - M.t - M.b;
  const x = (i: number) => M.l + (pts.length > 1 ? (i / (pts.length - 1)) * cw : cw / 2);
  const y = (v: number) => M.t + ch - (v / max) * ch;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const actual = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.open != null);
  const every = Math.max(1, Math.ceil(pts.length / 8));
  const h = hover != null ? pts[hover] : null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${projectId}`} className="hover:text-indigo-700">{data.project.title}</Link><span>/</span><span className="text-slate-800">Burndown</span>
      </div>
      <h2 className="text-[18px] font-semibold text-slate-900">{data.project.title} · Burndown</h2>
      <p className="mb-3 text-[12.5px] text-slate-500">Open to-dos at the end of each week, from this project&rsquo;s activities. {data.openNow} open now of {data.total} logged this term.</p>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex gap-4 text-[12px] text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-indigo-600" /> Open to-dos</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-slate-400" /> Ideal pace</span>
        </div>
        {pts.length === 0 ? <p className="text-[12.5px] text-slate-400">This project has no term to chart.</p> : (
          <div className="relative overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img" aria-label="Burndown of open to-dos by week" onMouseLeave={() => setHover(null)}>
              {ticks.map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#E2E8F0" /><text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748B">{v}</text></g>)}
              {pts.map((p, i) => i % every === 0 || i === pts.length - 1 ? <text key={p.weekEnd} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748B">{fmt(p.weekEnd)}</text> : null)}
              <polyline points={pts.map((p, i) => `${x(i)},${y(p.ideal)}`).join(" ")} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="5 4" />
              {actual.length ? <polyline points={actual.map(({ p, i }) => `${x(i)},${y(p.open!)}`).join(" ")} fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinejoin="round" /> : null}
              {actual.length ? (() => { const last = actual[actual.length - 1]; return <circle cx={x(last.i)} cy={y(last.p.open!)} r="4.5" fill="#4F46E5" stroke="#fff" strokeWidth="2" />; })() : null}
              {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ch} stroke="#94A3B8" /> : null}
              {pts.map((p, i) => <rect key={`h${i}`} x={x(i) - cw / Math.max(1, pts.length - 1) / 2} y={M.t} width={cw / Math.max(1, pts.length - 1)} height={ch} fill="transparent" onMouseEnter={() => setHover(i)} />)}
            </svg>
            {h ? <div className="pointer-events-none absolute top-2 rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] text-white shadow" style={{ left: `${(x(hover!) / W) * 100}%`, transform: "translateX(-50%)" }}>Week ending {fmt(h.weekEnd)}: {h.open != null ? <b>{h.open} open</b> : "not reached yet"} · ideal {h.ideal}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
