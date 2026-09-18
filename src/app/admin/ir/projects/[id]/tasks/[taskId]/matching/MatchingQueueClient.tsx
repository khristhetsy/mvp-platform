"use client";

/**
 * Matching queue — reached only from a task, so every confirmed investor lands on the
 * right project and week. Banner names the project + week with a back link and the count
 * already on the task. Proposals come from the Investor Fit engine filtered by sector,
 * fit tier and data source; investors already on the project are excluded. Confirm
 * creates the matches and returns to the task form's Matching tab.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRange } from "@/lib/ir/milestones";
import type { IrMilestone, IrProject, IrTask } from "@/lib/ir/types";

type Opt = { key: string; label: string };
type Row = { contactId: string; name: string | null; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string; sectors: string[]; types: string[]; dataSource: string | null; alsoOn: string[] };
type Payload = {
  project: IrProject; task: IrTask | null; week: IrMilestone | null; onTask: number;
  options: { sectors: string[]; stages: Opt[]; raises: Opt[]; revenues: Opt[]; types: Opt[] };
  filters: { industry: string[]; stage: string[]; raise: string[]; revenue: string[]; investorType: string[]; source: string; tier: string };
  rows: Row[]; total: number; thin: boolean;
};
const TIER_CLS = { high: "bg-emerald-50 text-emerald-700", medium: "bg-amber-50 text-amber-700", low: "bg-slate-100 text-slate-600" };
const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-[11.5px] ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;

export function MatchingQueueClient({ projectId, taskId }: { projectId: string; taskId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Payload["filters"] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (filters: Payload["filters"] | null) => {
    setLoading(true);
    const q = new URLSearchParams({ project: projectId, task: taskId });
    if (filters) { q.set("industry", filters.industry.join(",")); q.set("stage", filters.stage.join(",")); q.set("raise", filters.raise.join(",")); q.set("revenue", filters.revenue.join(",")); q.set("type", filters.investorType.join(",")); q.set("source", filters.source); q.set("tier", filters.tier); }
    const r = await fetch(`/api/admin/ir/matching?${q}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setError(j.error ?? "Couldn't build the queue."); return; }
    setData(j); setF(j.filters); setError(null);
  }, [projectId, taskId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(null); }, [load]);

  function toggle<K extends "industry" | "stage" | "raise" | "revenue" | "investorType">(key: K, v: string) {
    if (!f) return;
    const cur = f[key];
    const nf = { ...f, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    setF(nf); void load(nf);
  }
  function setOne(key: "source" | "tier", v: string) { if (!f) return; const nf = { ...f, [key]: v }; setF(nf); void load(nf); }

  async function confirm() {
    if (!data || !picked.size) { setError("Select at least one investor."); return; }
    setBusy(true); setError(null);
    const meta = Object.fromEntries(data.rows.filter((r) => picked.has(r.contactId)).map((r) => [r.contactId, { fitTier: r.tier, dataSource: r.dataSource }]));
    const r = await fetch("/api/admin/ir/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId, investorContactIds: [...picked], meta }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't confirm the matches."); return; }
    router.push(`/admin/ir/projects/${projectId}/tasks/${taskId}?tab=matching&added=${(j.created ?? []).length}`);
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data || !f) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const back = `/admin/ir/projects/${projectId}/tasks/${taskId}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-indigo-900">Matching for {data.project.title}{data.week ? ` · ${data.week.label}` : ""}</p>
          <p className="text-[12px] text-indigo-800">{data.week ? `${formatRange(data.week.starts_on, data.week.ends_on)} · ` : ""}{data.onTask} investor{data.onTask === 1 ? "" : "s"} already on this task. Confirmed investors land in Matched with a &ldquo;Send intro email&rdquo; to-do.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load(f)} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">{loading ? "Scoring…" : "Run matching again"}</button>
        <Link href={back} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100">← Back to task</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sector <span className="font-normal normal-case tracking-normal">(at least one)</span></p>
        <div className="flex flex-wrap gap-1">{data.options.sectors.map((s) => <button key={s} type="button" onClick={() => toggle("industry", s)} className={chip(f.industry.includes(s))}>{s}</button>)}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Group label="Operating stage" opts={data.options.stages} sel={f.stage} on={(v) => toggle("stage", v)} />
          <Group label="Raise" opts={data.options.raises} sel={f.raise} on={(v) => toggle("raise", v)} />
          <Group label="Revenue" opts={data.options.revenues} sel={f.revenue} on={(v) => toggle("revenue", v)} />
          <Group label="Investor type" opts={data.options.types.filter((t) => t.key !== "any")} sel={f.investorType} on={(v) => toggle("investorType", v)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-slate-600">
          <label>Data source <select value={f.source} onChange={(e) => setOne("source", e.target.value)} className="ml-1 rounded-md border border-slate-200 px-2 py-1"><option value="any">Any</option><option value="verified">Verified</option><option value="self_reported">Self-reported</option></select></label>
          <label>Fit tier <select value={f.tier} onChange={(e) => setOne("tier", e.target.value)} className="ml-1 rounded-md border border-slate-200 px-2 py-1"><option value="any">Any</option><option value="high">High (≥70)</option><option value="medium">Medium (50–69)</option><option value="low">Low</option></select></label>
          <span className="ml-auto">{loading ? "Scoring…" : `${data.rows.length} proposed${data.total > data.rows.length ? ` of ${data.total}` : ""}`}</span>
        </div>
      </div>

      {data.thin ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">The investor match index isn&rsquo;t built yet, so the engine has nothing to score. Rebuild it from Sales Hub › Settings, then reload.</p> : null}
      {!f.industry.length ? <p className="mt-3 text-[12.5px] text-slate-500">Pick at least one sector to see proposals.</p> : null}

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="w-8 px-3 py-2"></th><th className="py-2 pr-2 font-medium">Investor</th><th className="py-2 pr-2 font-medium">Firm</th><th className="py-2 pr-2 font-medium">Fit</th><th className="py-2 pr-2 font-medium">Why</th><th className="py-2 pr-2 font-medium">Data source</th><th className="py-2 pr-3 font-medium">Also matched</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((r) => (
              <tr key={r.contactId} className={picked.has(r.contactId) ? "bg-indigo-50/40" : "hover:bg-slate-50"}>
                <td className="px-3 py-2"><input type="checkbox" checked={picked.has(r.contactId)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.contactId); else n.delete(r.contactId); return n; })} aria-label={`Select ${r.name ?? r.firm}`} /></td>
                <td className="py-2 pr-2 font-medium text-slate-900">{r.name ?? "—"}</td>
                <td className="py-2 pr-2 text-slate-700">{r.firm}</td>
                <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_CLS[r.tier]}`}>{r.fit}% · {r.tier}</span></td>
                <td className="max-w-[260px] truncate py-2 pr-2 text-slate-500" title={r.summary}>{r.summary}</td>
                <td className="py-2 pr-2 text-slate-600">{r.dataSource === "verified" ? "Verified" : r.dataSource === "self_reported" ? "Self-reported" : "Unverified"}</td>
                <td className="py-2 pr-3 text-slate-500">{r.alsoOn.length ? r.alsoOn.join(", ") : "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && f.industry.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{loading ? "Scoring…" : "No proposals for these filters — widen the sector or drop the tier / source filter."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <span className="text-[12.5px] text-slate-600">{picked.size} selected</span>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
        <Link href={back} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">Cancel</Link>
        <button type="button" disabled={busy || !picked.size} onClick={confirm} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Confirming…" : `Confirm ${picked.size || ""} investor${picked.size === 1 ? "" : "s"}`}</button>
      </div>
    </div>
  );
}

function Group({ label, opts, sel, on }: { label: string; opts: Opt[]; sel: string[]; on: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">{opts.map((o) => <button key={o.key} type="button" onClick={() => on(o.key)} className={chip(sel.includes(o.key))}>{o.label}</button>)}</div>
    </div>
  );
}
