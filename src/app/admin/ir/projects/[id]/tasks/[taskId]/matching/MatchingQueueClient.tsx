"use client";

/**
 * Matching queue — reached only from a task, so every confirmed investor lands on the
 * right project and week. The Contacts-style search bar drives it: typed text narrows by
 * investor / firm, the Filters column holds sector, stage, raise, revenue, investor type,
 * data source and fit tier (the engine re-runs on every change), Group By groups the
 * proposals, Favorites saves a search per user or shared. Confirm creates the matches
 * and returns to the task form's Matching tab.
 *
 * Columns can be shown or hidden (remembered in this browser). The Outreach column shows
 * how far each investor already got with this founder on another of the founder's
 * projects and links to that match; the investor name opens a profile panel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type FieldFilter, type GroupOption, type SearchState } from "@/components/admin/OdooSearchBar";
import { InvestorSearchTab } from "./InvestorSearchTab";
import { COLS, DEFAULT_COLS, TIER_CLS, STAGE_CLS, srcLabel, fmtDay, cell, OutreachPill, sortRows, nextSort, SortTh, type ColKey, type Row, type SortKey, type SortState } from "./matching-table";
import { formatRange } from "@/lib/ir/milestones";
import { SEQUENCE_TEMPLATES } from "@/lib/ir/sequence-templates";
import { IR_STAGE_LABEL, type IrMilestone, type IrProject, type IrStage, type IrTask } from "@/lib/ir/types";

type Opt = { key: string; label: string };
type Filters = { industry: string[]; stage: string[]; raise: string[]; revenue: string[]; investorType: string[]; source: string; tier: string };
type Payload = {
  project: IrProject; task: IrTask | null; week: IrMilestone | null; onTask: number;
  options: { sectors: string[]; stages: Opt[]; raises: Opt[]; revenues: Opt[]; types: Opt[] };
  filters: Filters; rows: Row[]; total: number; thin: boolean;
  defaults?: { from?: "company" | "founder_profile" | "both" };
};
const SOURCE_OPTS: Opt[] = [{ key: "verified", label: "Verified" }, { key: "self_reported", label: "Self-reported" }];
const TIER_OPTS: Opt[] = [{ key: "high", label: "High (≥70)" }, { key: "medium", label: "Medium (50–69)" }, { key: "low", label: "Low" }];
const GROUPS: GroupOption[] = [{ id: "none", label: "None" }, { id: "firm", label: "Firm" }, { id: "tier", label: "Fit tier" }, { id: "type", label: "Investor type" }, { id: "source", label: "Data source" }];

 const COLS_KEY = "ir.matching.columns.v2";
/** v1 predates Phone and Email: carry a saved v1 choice over with the two new columns on. */
const COLS_KEY_V1 = "ir.matching.columns";

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
  const [cols, setCols] = useState<ColKey[]>(DEFAULT_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const [hideContacted, setHideContacted] = useState(false);
  const [profile, setProfile] = useState<Row | null>(null);
  const [mode, setMode] = useState<"match" | "search">("match");
  const [sort, setSort] = useState<SortState>(null);
  const onSort = useCallback((k: SortKey) => setSort((s) => nextSort(s, k)), []);
  // Rows the search tab has shown, so selections made there keep their details here.
  const [found, setFound] = useState<Row[]>([]);
  const onFoundRows = useCallback((rs: Row[]) => setFound((prev) => { const m = new Map(prev.map((r) => [r.contactId, r])); for (const r of rs) m.set(r.contactId, r); return [...m.values()]; }), []);
  const [seq, setSeq] = useState<null | { setupNeeded: boolean; staff: Array<{ id: string; name: string }>; template: string; via: "icapos" | "gmail"; manager: string; notifyEmail: boolean }>(null);

  async function openSequence() {
    if (seq) { setSeq(null); return; }
    const [s, pr] = await Promise.all([fetch("/api/admin/ir/sequences").then((r) => r.json()).catch(() => ({ setupNeeded: true })), fetch(`/api/admin/ir/projects/${projectId}`).then((r) => r.json()).catch(() => ({}))]);
    setSeq({ setupNeeded: !!s.setupNeeded, staff: pr.staff ?? [], template: Object.keys(SEQUENCE_TEMPLATES)[0], via: "icapos", manager: pr.project?.owner_id ?? "", notifyEmail: true });
  }

  useEffect(() => {
    let saved: ColKey[] | null = null;
    try {
      const raw = window.localStorage.getItem(COLS_KEY);
      const v1 = raw ? null : window.localStorage.getItem(COLS_KEY_V1);
      const v = raw ? JSON.parse(raw) : v1 ? [...(JSON.parse(v1) as string[]), "phone", "email"] : null;
      if (Array.isArray(v)) saved = COLS.map((c) => c.key).filter((k) => v.includes(k));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the column choice after mount (localStorage isn't available during SSR)
    if (saved) setCols(saved);
  }, []);
  function setColumns(next: ColKey[]) {
    setCols(next);
    try { window.localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  useEffect(() => {
    if (!colsOpen) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-cols-menu]")) setColsOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setColsOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [colsOpen]);

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

  const rows = useMemo(() => sortRows((data?.rows ?? []).filter((r) => textMatch(search?.q ?? "", r.name, r.firm, r.email ?? "", r.summary, r.sectors.join(" "), r.types.join(" "), r.alsoOn.join(" "), r.founderOutreach ? IR_STAGE_LABEL[r.founderOutreach.stage] : "") && !(hideContacted && r.founderOutreach)), sort), [data, search, hideContacted, sort]);
  const grouped = useMemo(() => {
    const gb = search?.groupBy;
    const g = gb && gb !== "none" ? gb : null;
    if (!g) return [{ label: null as string | null, rows }];
    const keyOf = (r: Row) => g === "firm" ? r.firm || "—" : g === "tier" ? `${r.tier[0].toUpperCase()}${r.tier.slice(1)} fit` : g === "type" ? (r.types[0] ?? "—") : srcLabel(r.dataSource);
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
    return [...m.entries()].map(([label, rs]) => ({ label, rows: rs }));
  }, [rows, search]);

  const contacted = useMemo(() => (data?.rows ?? []).filter((r) => r.founderOutreach).length, [data]);
  const pickedContacted = useMemo(() => [...new Map([...(data?.rows ?? []), ...found].map((r) => [r.contactId, r])).values()].filter((r) => picked.has(r.contactId) && r.founderOutreach).length, [data, found, picked]);
  const visibleIds = rows.filter((r) => !r.onProject).map((r) => r.contactId);
  const pickedVisible = visibleIds.filter((id) => picked.has(id)).length;
  const allVisible = visibleIds.length > 0 && pickedVisible === visibleIds.length;
  function toggleAll(on: boolean) {
    setPicked((p) => { const n = new Set(p); for (const id of visibleIds) { if (on) n.add(id); else n.delete(id); } return n; });
  }

  async function confirm(withSequence = false) {
    if (!data || !picked.size) { setError("Select at least one investor."); return; }
    if (withSequence && (!seq || seq.setupNeeded || !seq.manager)) { setError("Pick an account manager for the sequence."); return; }
    setBusy(true); setError(null);
    const meta = Object.fromEntries(data.rows.filter((r) => picked.has(r.contactId)).map((r) => [r.contactId, { fitTier: r.tier, dataSource: r.dataSource }]));
    const r = await fetch("/api/admin/ir/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId, investorContactIds: [...picked], meta }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't confirm the matches."); return; }
    let sequenced = "";
    if (withSequence && seq && (j.created ?? []).length) {
      const s = await fetch("/api/admin/ir/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchIds: j.created, template: seq.template, via: seq.via, managerId: seq.manager, notifyEmail: seq.notifyEmail }) });
      const sj = await s.json().catch(() => ({}));
      sequenced = `&sequenced=${s.ok ? sj.started ?? 0 : 0}`;
    }
    router.push(`/admin/ir/projects/${projectId}/tasks/${taskId}?tab=matching&added=${(j.created ?? []).length}${sequenced}`);
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data || !search) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const back = `/admin/ir/projects/${projectId}/tasks/${taskId}`;
  const noSector = !(search.fields.sector?.length);
  const tabsEl = (
        <div className="flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="How to find investors">
          {([["match", "Proposed matches"], ["search", "Search all investors"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`px-3 py-1.5 text-[12.5px] ${mode === k ? "bg-indigo-50 font-semibold text-indigo-800" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>)}
        </div>
  );
  const toolsEl = (<>
        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600"><input type="checkbox" checked={hideContacted} onChange={(e) => setHideContacted(e.target.checked)} /> Hide already contacted</label>
        <div className="relative" data-cols-menu>
          <button type="button" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} aria-haspopup="true" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"><i className="ti ti-columns" aria-hidden="true" /> Columns <span className="text-slate-400">{cols.length}/{COLS.length}</span></button>
          {colsOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" role="menu">
              <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Show columns</p>
              <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-slate-400"><input type="checkbox" checked disabled /> Investor <span className="ml-auto text-[10.5px]">Always on</span></label>
              {COLS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setColumns(e.target.checked ? COLS.filter((x) => x.key === c.key || cols.includes(x.key)).map((x) => x.key) : cols.filter((k) => k !== c.key))} /> {c.label}
                </label>
              ))}
              <div className="mt-1 flex justify-between border-t border-slate-100 px-2 pt-2 text-[12px]">
                <button type="button" onClick={() => setColumns(DEFAULT_COLS)} className="text-indigo-700 hover:underline">Reset to default</button>
                <button type="button" onClick={() => setColumns(COLS.map((c) => c.key))} className="text-indigo-700 hover:underline">Show all</button>
              </div>
            </div>
          ) : null}
        </div>
  </>);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-indigo-900">Matching for {data.project.title}{data.week ? ` · ${data.week.label}` : ""}</p>
          <p className="text-[12px] text-indigo-800">{data.week ? `${formatRange(data.week.starts_on, data.week.ends_on)} · ` : ""}{data.onTask} investor{data.onTask === 1 ? "" : "s"} already on this task. Confirmed investors land in Matched with a &ldquo;Send intro email&rdquo; to-do.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load(toFilters(search, data.options))} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">{loading ? "Scoring…" : "Run matching again"}</button>
      </div>

      {mode === "search" ? (
        <InvestorSearchTab
          projectId={projectId} cols={cols} picked={picked} setPicked={setPicked} hideContacted={hideContacted}
          sort={sort} onSort={onSort} onProfile={setProfile} onRows={onFoundRows} tabs={tabsEl} tools={toolsEl}
        />
      ) : (<>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {tabsEl}
        <OdooSearchBar scope="ir-matching" state={search} onChange={onSearch} quick={[]} fields={fields} groups={GROUPS} noGroupId="none" placeholder="Search investor or firm…" width={620} />
        {toolsEl}
        <span className="ml-auto text-[12px] text-slate-600">{loading ? "Scoring…" : `${rows.length} proposed${data.total > data.rows.length ? ` of ${data.total}` : ""}`}</span>
      </div>

      {data.thin ? <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">The investor match index isn&rsquo;t built yet, so the engine has nothing to score. Rebuild it from Sales Hub › Settings, then reload.</p> : null}
      {mode === "match" && noSector ? <p className="mb-3 text-[12.5px] text-slate-500">Add at least one Sector under Filters to see proposals{data.project.company_id ? "" : ". This project has no iCapOS company and the founder's Odoo questionnaire names no industry, so there was nothing to start from"}. Or use Search all investors.</p> : null}
      {mode === "match" && !noSector && (data.defaults?.from === "founder_profile" || data.defaults?.from === "both") ? <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900">Filters start from the founder&rsquo;s Odoo questionnaire (industries, capital sought, revenue, stage and investor types). Change them under Filters.</p> : null}
      {contacted ? <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900"><b>{contacted} of these investors were already worked for {data.project.founder_name ?? data.project.title}</b> on another of the founder&rsquo;s projects. They are flagged in the Outreach column; click a status to open that match.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500">
            <th className="w-8 px-3 py-2"><input type="checkbox" checked={allVisible} ref={(el) => { if (el) el.indeterminate = pickedVisible > 0 && !allVisible; }} onChange={(e) => toggleAll(e.target.checked)} disabled={!visibleIds.length} aria-label={allVisible ? "Unselect all" : "Select all"} title={allVisible ? "Unselect all" : "Select all"} /></th>
            <SortTh label="Investor" k="name" sort={sort} onSort={onSort} />
            {cols.map((k) => <SortTh key={k} label={COLS.find((c) => c.key === k)?.label ?? k} k={k} sort={sort} onSort={onSort} />)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {grouped.map((g) => [
              g.label ? <tr key={`g:${g.label}`} className="bg-slate-50/70"><td colSpan={cols.length + 2} className="px-3 py-1.5 text-[11.5px] font-semibold text-slate-700">{g.label} <span className="font-normal text-slate-400">({g.rows.length})</span></td></tr> : null,
              ...g.rows.map((r) => (
                <tr key={r.contactId} className={picked.has(r.contactId) ? "bg-indigo-50/40" : r.founderOutreach ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-slate-50"}>
                  <td className="px-3 py-2"><input type="checkbox" disabled={r.onProject} title={r.onProject ? "Already on this project" : undefined} checked={picked.has(r.contactId)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.contactId); else n.delete(r.contactId); return n; })} aria-label={`Select ${r.name ?? r.firm}`} /></td>
                  <td className="py-2 pr-2 font-medium text-slate-900">
                    <button type="button" onClick={() => setProfile(r)} className="text-left hover:text-indigo-700 hover:underline">{r.name ?? r.firm ?? "—"}</button>
                    {r.founderOutreach ? <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white" title="Already worked for this founder">!</span> : null}
                  </td>
                  {cols.map((k) => <td key={k} className={k === "why" ? "max-w-[260px] truncate py-2 pr-2 text-slate-500" : "py-2 pr-2 text-slate-600"} title={k === "why" ? r.summary : undefined}>{cell(k, r)}</td>)}
                </tr>
              )),
            ])}
            {rows.length === 0 && !noSector ? <tr><td colSpan={cols.length + 2} className="px-3 py-6 text-center text-slate-400">{loading ? "Scoring…" : hideContacted && contacted ? "Every proposal here was already worked for this founder. Untick “Hide already contacted” to see them." : "No proposals for these filters — widen the sector or drop the tier / source filter."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      </>)}

      <div className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <span className="text-[12.5px] text-slate-600">{picked.size} selected</span>
        {picked.size ? <button type="button" onClick={() => setPicked(new Set())} className="text-[12.5px] text-indigo-700 hover:underline">Unselect all</button> : null}
        {pickedContacted ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-900">{pickedContacted} already worked for this founder</span> : null}
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
        <Link href={back} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">Cancel</Link>
        <button type="button" disabled={busy || !picked.size} onClick={() => void openSequence()} aria-expanded={!!seq} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"><i className="ti ti-bolt" aria-hidden="true" /> Confirm + auto sequence</button>
        <button type="button" disabled={busy || !picked.size} onClick={() => void confirm()} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Confirming…" : `Confirm ${picked.size || ""} investor${picked.size === 1 ? "" : "s"}`}</button>
      </div>

      {seq ? (
        <div className="fixed bottom-20 right-6 z-30 w-[360px] rounded-xl border border-indigo-200 bg-white p-4 text-[12.5px] shadow-xl" role="dialog" aria-label="Auto sequence for the selected investors">
          <div className="mb-2 flex items-center"><p className="text-[13.5px] font-semibold text-slate-900"><i className="ti ti-bolt" aria-hidden="true" /> Auto sequence for {picked.size} investor{picked.size === 1 ? "" : "s"}</p><button type="button" onClick={() => setSeq(null)} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button></div>
          {seq.setupNeeded ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">Auto sequences need migration <code>20260928100000_ir_sequences.sql</code> run in the Supabase SQL editor first.</p> : (
            <div className="space-y-2">
              <label className="block text-[11.5px] text-slate-500">Sequence<select value={seq.template} onChange={(e) => setSeq({ ...seq, template: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]">{Object.entries(SEQUENCE_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name} · {t.steps.length} steps (days {t.steps.map((s) => s.day).join(", ")})</option>)}</select></label>
              <label className="block text-[11.5px] text-slate-500">Account manager to alert<select value={seq.manager} onChange={(e) => setSeq({ ...seq, manager: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]">{seq.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <div className="flex gap-4">{(["icapos", "gmail"] as const).map((k) => <label key={k} className="inline-flex items-center gap-1.5"><input type="radio" name="bulk-via" checked={seq.via === k} onChange={() => setSeq({ ...seq, via: k })} /> {k === "icapos" ? "iCapOS" : "Gmail"}</label>)}</div>
              {seq.via === "gmail" ? <p className="text-[11.5px] text-amber-700">Opens and clicks can&rsquo;t be tracked on Gmail sends.</p> : null}
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={seq.notifyEmail} onChange={(e) => setSeq({ ...seq, notifyEmail: e.target.checked })} /> Email the alerts too (always in iCapOS notifications)</label>
              <p className="text-[11.5px] text-slate-500">Alerts on opens, clicks, replies and meetings; stops on a reply or meeting. Edit any one of them later from its record. The first emails go out within 15 minutes.</p>
              <button type="button" disabled={busy || !seq.manager} onClick={() => void confirm(true)} className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Confirming…" : `Confirm ${picked.size} and start sequence`}</button>
            </div>
          )}
        </div>
      ) : null}
      {profile ? <InvestorPanel row={profile} onClose={() => setProfile(null)} picked={picked.has(profile.contactId)} onPick={(on) => setPicked((p) => { const n = new Set(p); if (on) n.add(profile.contactId); else n.delete(profile.contactId); return n; })} /> : null}
    </div>
  );
}



type History = { investor: { id: string; name: string | null; firm: string | null; dataSource: string | null; verifiedAt: string | null; website: string | null }; matches: Array<{ matchId: string; projectId: string; projectTitle: string; founderName: string | null; stage: IrStage; stageChangedAt: string }> };

/** Side panel for one proposed investor: what the queue knows plus every IR match they are on. */
function InvestorPanel({ row, onClose, picked, onPick }: { row: Row; onClose: () => void; picked: boolean; onPick: (on: boolean) => void }) {
  const [hist, setHist] = useState<History | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(`/api/admin/ir/investors/${row.contactId}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setErr(j.error ?? "Couldn't load the investor."); else setHist(j);
    });
    return () => { live = false; };
  }, [row.contactId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const name = row.name ?? row.firm ?? "Investor";
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={`${name} profile`} className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-50 text-[15px] font-semibold text-indigo-700">{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-slate-900">{name}</p>
            <p className="truncate text-[12.5px] text-slate-500">{row.firm && row.firm !== row.name ? row.firm : "Independent"}{hist?.investor.website ? <> · <a href={hist.investor.website.startsWith("http") ? hist.investor.website : `https://${hist.investor.website}`} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">website</a></> : null}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-[12.5px]">
          <section>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Outreach for this founder</h4>
            <OutreachPill o={row.founderOutreach} />
            {row.founderOutreach ? <p className="mt-1.5 text-slate-500">On {row.founderOutreach.projectTitle}.</p> : <p className="mt-1.5 text-slate-500">No match with this founder on any of their projects.</p>}
          </section>
          <section>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Fit for this project</h4>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-slate-500">Fit</dt><dd>{row.fit < 0 ? <span className="text-slate-500">Not scored: found by search</span> : <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_CLS[row.tier]}`}>{row.fit}% · {row.tier}</span>}</dd>
              <dt className="text-slate-500">Why</dt><dd className="text-slate-700">{row.summary || "—"}</dd>
              <dt className="text-slate-500">Sectors</dt><dd className="text-slate-700">{row.sectors.join(", ") || "—"}</dd>
              <dt className="text-slate-500">Investor type</dt><dd className="text-slate-700">{row.types.join(", ") || "—"}</dd>
              <dt className="text-slate-500">Data source</dt><dd className="text-slate-700">{srcLabel(row.dataSource)}{hist?.investor.verifiedAt ? ` · verified ${fmtDay(hist.investor.verifiedAt)}` : ""}</dd>
            </dl>
          </section>
          <section>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">On other projects</h4>
            {err ? <p className="text-rose-600">{err}</p> : !hist ? <p className="text-slate-400">Loading…</p> : hist.matches.length === 0 ? <p className="text-slate-500">Not matched on any IR project yet.</p> : (
              <ul className="space-y-1.5">
                {hist.matches.map((m) => (
                  <li key={m.matchId} className="flex items-center gap-2">
                    <Link href={`/admin/ir/matches/${m.matchId}`} className="min-w-0 flex-1 truncate text-slate-800 hover:text-indigo-700">{m.projectTitle}</Link>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_CLS[m.stage] ?? "bg-slate-100 text-slate-600"}`}>{IR_STAGE_LABEL[m.stage]}</span>
                    <span className="w-14 text-right text-[11px] text-slate-400">{fmtDay(m.stageChangedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={() => onPick(!picked)} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${picked ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>{picked ? "Unselect" : "Select for this task"}</button>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">Close</button>
        </div>
      </aside>
    </div>
  );
}
