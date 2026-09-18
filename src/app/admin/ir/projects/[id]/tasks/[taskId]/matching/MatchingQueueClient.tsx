"use client";

/**
 * Matching queue — reached only from a task, so every confirmed investor lands on the
 * right project and week. The Contacts-style search bar drives it: typed text narrows by
 * investor / firm, the Filters column holds sector, stage, raise, revenue, investor type,
 * data source and fit tier (the engine re-runs on every change), Group By groups the
 * proposals, Favorites saves a search per user or shared. Confirm creates the matches
 * and returns to the task form's Matching tab.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type FieldFilter, type GroupOption, type SearchState } from "@/components/admin/OdooSearchBar";
import { formatRange } from "@/lib/ir/milestones";
import type { IrMilestone, IrProject, IrTask } from "@/lib/ir/types";

type Opt = { key: string; label: string };
type Row = { contactId: string; name: string | null; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string; sectors: string[]; types: string[]; dataSource: string | null; alsoOn: string[] };
type Filters = { industry: string[]; stage: string[]; raise: string[]; revenue: string[]; investorType: string[]; source: string; tier: string };
type Payload = {
  project: IrProject; task: IrTask | null; week: IrMilestone | null; onTask: number;
  options: { sectors: string[]; stages: Opt[]; raises: Opt[]; revenues: Opt[]; types: Opt[] };
  filters: Filters; rows: Row[]; total: number; thin: boolean;
};
const TIER_CLS = { high: "bg-emerald-50 text-emerald-700", medium: "bg-amber-50 text-amber-700", low: "bg-slate-100 text-slate-600" };
const SOURCE_OPTS: Opt[] = [{ key: "verified", label: "Verified" }, { key: "self_reported", label: "Self-reported" }];
const TIER_OPTS: Opt[] = [{ key: "high", label: "High (≥70)" }, { key: "medium", label: "Medium (50–69)" }, { key: "low", label: "Low" }];
const GROUPS: GroupOption[] = [{ id: "none", label: "None" }, { id: "firm", label: "Firm" }, { id: "tier", label: "Fit tier" }, { id: "type", label: "Investor type" }, { id: "source", label: "Data source" }];
const srcLabel = (s: string | null) => (s === "verified" ? "Verified" : s === "self_reported" ? "Self-reported" : "Unverified");

/** Filters ↔ search-bar field state (labels in the bar, keys on the wire). */
function toState(f: Filters, o: Payload["options"]): SearchState {
  const lab = (opts: Opt[], keys: string[]) => keys.map((k) => opts.find((x) => x.key === k)?.label ?? k);
  const fields: Record<string, string[]> = {};
  if (f.industry.length) fields.sector = f.industry;
  if (f.stage.length) fields.stage = lab(o.stages, f.stage);
  if (f.raise.length) fields.raise = lab(o.raises, f.raise);
  if (f.revenue.length) fields.revenue = lab(o.revenues, f.revenue);
  if (f.investorType.length) fields.type = lab(o.types, f.investorType);
  if (f.source !== "any") fields.source = lab(SOURCE_OPTS, [f.source]);
  if (f.tier !== "any") fields.tier = lab(TIER_OPTS, [f.tier]);
  return { ...EMPTY_SEARCH, groupBy: "none", fields };
}
function toFilters(s: SearchState, o: Payload["options"]): Filters {
  const key = (opts: Opt[], labels: string[] = []) => labels.map((l) => opts.find((x) => x.label === l)?.key ?? l);
  return {
    industry: s.fields.sector ?? [], stage: key(o.stages, s.fields.stage), raise: key(o.raises, s.fields.raise), revenue: key(o.revenues, s.fields.revenue), investorType: key(o.types, s.fields.type),
    source: key(SOURCE_OPTS, s.fields.source)[0] ?? "any", tier: key(TIER_OPTS, s.fields.tier)[0] ?? "any",
  };
}

export function MatchingQueueClient({ projectId, taskId }: { projectId: string; taskId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (filters: Filters | null) => {
    setLoading(true);
    const q = new URLSearchParams({ project: projectId, task: taskId });
    if (filters) { q.set("industry", filters.industry.join(",")); q.set("stage", filters.stage.join(",")); q.set("raise", filters.raise.join(",")); q.set("revenue", filters.revenue.join(",")); q.set("type", filters.investorType.join(",")); q.set("source", filters.source); q.set("tier", filters.tier); }
    const r = await fetch(`/api/admin/ir/matching?${q}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setError(j.error ?? "Couldn't build the queue."); return null; }
    setData(j); setError(null);
    return j as Payload;
  }, [projectId, taskId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then seed the search bar from the project's defaults
  useEffect(() => { void load(null).then((j) => { if (j) setSearch((s) => s ?? toState(j.filters, j.options)); }); }, [load]);

  function onSearch(next: SearchState) {
    if (!data) return;
    const before = search ? JSON.stringify(search.fields) : "";
    setSearch(next);
    if (JSON.stringify(next.fields) !== before) void load(toFilters(next, data.options));
  }

  const fields: FieldFilter[] = useMemo(() => data ? [
    { key: "sector", label: "Sector", options: data.options.sectors },
    { key: "stage", label: "Operating stage", options: data.options.stages.map((o) => o.label) },
    { key: "raise", label: "Raise", options: data.options.raises.map((o) => o.label) },
    { key: "revenue", label: "Revenue", options: data.options.revenues.map((o) => o.label) },
    { key: "type", label: "Investor type", options: data.options.types.filter((t) => t.key !== "any").map((o) => o.label) },
    { key: "source", label: "Data source", options: SOURCE_OPTS.map((o) => o.label) },
    { key: "tier", label: "Fit tier", options: TIER_OPTS.map((o) => o.label) },
  ] : [], [data]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => textMatch(search?.q ?? "", r.name, r.firm, r.summary)), [data, search]);
  const grouped = useMemo(() => {
    const g = search?.groupBy && search.groupBy !== "none" ? search.groupBy : null;
    if (!g) return [{ label: null as string | null, rows }];
    const keyOf = (r: Row) => g === "firm" ? r.firm || "—" : g === "tier" ? `${r.tier[0].toUpperCase()}${r.tier.slice(1)} fit` : g === "type" ? (r.types[0] ?? "—") : srcLabel(r.dataSource);
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
    return [...m.entries()].map(([label, rs]) => ({ label, rows: rs }));
  }, [rows, search]);

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
  if (!data || !search) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const back = `/admin/ir/projects/${projectId}/tasks/${taskId}`;
  const noSector = !(search.fields.sector?.length);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-indigo-900">Matching for {data.project.title}{data.week ? ` · ${data.week.label}` : ""}</p>
          <p className="text-[12px] text-indigo-800">{data.week ? `${formatRange(data.week.starts_on, data.week.ends_on)} · ` : ""}{data.onTask} investor{data.onTask === 1 ? "" : "s"} already on this task. Confirmed investors land in Matched with a &ldquo;Send intro email&rdquo; to-do.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load(toFilters(search, data.options))} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">{loading ? "Scoring…" : "Run matching again"}</button>
        <Link href={back} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100">← Back to task</Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <OdooSearchBar scope="ir-matching" state={search} onChange={onSearch} quick={[]} fields={fields} groups={GROUPS} noGroupId="none" placeholder="Search investor or firm…" width={720} />
        <span className="ml-auto text-[12px] text-slate-600">{loading ? "Scoring…" : `${rows.length} proposed${data.total > data.rows.length ? ` of ${data.total}` : ""}`}</span>
      </div>

      {data.thin ? <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">The investor match index isn&rsquo;t built yet, so the engine has nothing to score. Rebuild it from Sales Hub › Settings, then reload.</p> : null}
      {noSector ? <p className="mb-3 text-[12.5px] text-slate-500">Add at least one Sector under Filters to see proposals.</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="w-8 px-3 py-2"></th><th className="py-2 pr-2 font-medium">Investor</th><th className="py-2 pr-2 font-medium">Firm</th><th className="py-2 pr-2 font-medium">Fit</th><th className="py-2 pr-2 font-medium">Why</th><th className="py-2 pr-2 font-medium">Data source</th><th className="py-2 pr-3 font-medium">Also matched</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {grouped.map((g) => [
              g.label ? <tr key={`g:${g.label}`} className="bg-slate-50/70"><td colSpan={7} className="px-3 py-1.5 text-[11.5px] font-semibold text-slate-700">{g.label} <span className="font-normal text-slate-400">({g.rows.length})</span></td></tr> : null,
              ...g.rows.map((r) => (
                <tr key={r.contactId} className={picked.has(r.contactId) ? "bg-indigo-50/40" : "hover:bg-slate-50"}>
                  <td className="px-3 py-2"><input type="checkbox" checked={picked.has(r.contactId)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.contactId); else n.delete(r.contactId); return n; })} aria-label={`Select ${r.name ?? r.firm}`} /></td>
                  <td className="py-2 pr-2 font-medium text-slate-900">{r.name ?? "—"}</td>
                  <td className="py-2 pr-2 text-slate-700">{r.firm}</td>
                  <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_CLS[r.tier]}`}>{r.fit}% · {r.tier}</span></td>
                  <td className="max-w-[260px] truncate py-2 pr-2 text-slate-500" title={r.summary}>{r.summary}</td>
                  <td className="py-2 pr-2 text-slate-600">{srcLabel(r.dataSource)}</td>
                  <td className="py-2 pr-3 text-slate-500">{r.alsoOn.length ? r.alsoOn.join(", ") : "—"}</td>
                </tr>
              )),
            ])}
            {rows.length === 0 && !noSector ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{loading ? "Scoring…" : "No proposals for these filters — widen the sector or drop the tier / source filter."}</td></tr> : null}
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
