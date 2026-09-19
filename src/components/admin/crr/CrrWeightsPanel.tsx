"use client";

/**
 * CRR weights — Companies / Weights / History.
 *
 * Weights tab: edit the four audience profiles, the 13 factor maxima, the bands and
 * the traction floors; totals must hit exactly 100 before Save is allowed. "Preview
 * impact" re-runs the arithmetic over every scored company (no AI, no writes) so you
 * can see who moves before committing.
 *
 * History tab: every save is a version — diff, impact, compare, revert (which copies
 * an old version forward rather than editing it), plus one company's score over time.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dimension, ProfileKey } from "@/lib/crr/profiles";
import type { Bands, DiffRow, Floor, ImpactSnapshot, WeightSet } from "@/lib/crr/weight-sets";

type Shape = {
  dimensions: Array<{ key: Dimension; label: string }>;
  profiles: Array<{ key: ProfileKey; label: string; round: string }>;
  factors: Array<{ key: string; label: string; dimension: Dimension }>;
  codeDefaults: WeightSet;
};
type HistoryEntry = WeightSet & { diff: DiffRow[]; summary: string };
type Payload = { active: WeightSet; sets: HistoryEntry[]; scoreCounts: Record<string, number>; companiesByProfile: Record<string, number>; shape: Shape };
type Draft = { profiles: Record<ProfileKey, Record<Dimension, number>>; factors: Record<string, number>; bands: Bands; floors: Partial<Record<ProfileKey, Floor>> };
type Tab = "companies" | "weights" | "history";

const card = "rounded-xl border border-slate-200 bg-white";
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPri = "rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const num = "w-[62px] rounded-md border px-2 py-1 text-right text-[13px] tabular-nums focus:outline-none";
const fmtAt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const draftOf = (s: WeightSet): Draft => JSON.parse(JSON.stringify({ profiles: s.profiles, factors: s.factors, bands: s.bands, floors: s.floors }));

function Delta({ n }: { n: number | null }) {
  if (n === null || n === 0) return <span className="text-slate-400">—</span>;
  return <span className={n > 0 ? "text-emerald-700" : "text-rose-700"}>{n > 0 ? `+${n}` : n}</span>;
}
function Bar({ pct, muted }: { pct: number; muted?: boolean }) {
  return <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-slate-200 align-middle"><span className={`block h-full ${muted ? "bg-slate-300" : "bg-indigo-600"}`} style={{ width: `${Math.min(100, pct)}%` }} /></span>;
}

export function CrrWeightsPanel({ children, canEdit }: { children: ReactNode; canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>("companies");
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<ProfileKey>("seriesA_institutional");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ impact: ImpactSnapshot | null; errors: string[]; diff: DiffRow[] } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [revert, setRevert] = useState<HistoryEntry | null>(null);
  const [openVersion, setOpenVersion] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/crr/weights");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the weights."); return; }
    setData(j); setDraft((d) => d ?? draftOf(j.active)); setError(null);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(draftOf(data.active))), [data, draft]);
  const profileTotal = draft ? sum(Object.values(draft.profiles[profile] ?? {})) : 0;
  const factorTotal = draft ? sum(Object.values(draft.factors)) : 0;
  const balanced = profileTotal === 100 && factorTotal === 100 && data ? data.shape.profiles.every((p) => sum(Object.values(draft!.profiles[p.key] ?? {})) === 100) : false;

  function setWeight(p: ProfileKey, d: Dimension, v: number) {
    setDraft((s) => (s ? { ...s, profiles: { ...s.profiles, [p]: { ...s.profiles[p], [d]: v } } } : s));
    setPreview(null);
  }
  function setFactor(k: string, v: number) { setDraft((s) => (s ? { ...s, factors: { ...s.factors, [k]: v } } : s)); setPreview(null); }
  function setBand(k: keyof Bands, v: number) { setDraft((s) => (s ? { ...s, bands: { ...s.bands, [k]: v } } : s)); setPreview(null); }
  function setFloor(p: ProfileKey, v: number) {
    setDraft((s) => (s ? { ...s, floors: { ...s.floors, [p]: { minTraction: v, cap: s.floors[p]?.cap ?? "Developing" } } } : s));
    setPreview(null);
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    const r = await fetch("/api/admin/crr/weights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "That didn't work."); return null; }
    return j;
  }
  async function runPreview() {
    const j = await post({ action: "preview", set: draft });
    if (j) setPreview({ impact: j.impact ?? null, errors: j.errors ?? [], diff: j.diff ?? [] });
  }
  async function doSave(version: string, reason: string, rescore: boolean) {
    const j = await post({ action: "save", set: draft, version, reason, rescore });
    if (!j) return;
    setSaveOpen(false); setPreview(null);
    setNotice(`Saved ${j.set.version}${j.rescored?.updated ? ` · ${j.rescored.updated} companies re-scored` : ""}.`);
    setDraft(draftOf(j.set)); await load(); setTab("history");
  }
  async function doRevert(entry: HistoryEntry, reason: string, rescore: boolean) {
    const j = await post({ action: "revert", id: entry.id, reason, rescore });
    if (!j) return;
    setRevert(null);
    setNotice(`Reverted to ${entry.version} as ${j.set.version}${j.rescored?.updated ? ` · ${j.rescored.updated} companies re-scored` : ""}.`);
    setDraft(draftOf(j.set)); await load();
  }

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-[13px] ${tab === t ? "border-indigo-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
  );

  return (
    <div>
      <div className="mb-4 flex border-b border-slate-200">{tabBtn("companies", "Companies")}{tabBtn("weights", "Weights")}{tabBtn("history", "History")}</div>
      {error ? <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      {notice ? <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice(null)}>✕</button></div> : null}

      {tab === "companies" ? children : null}

      {tab === "weights" && data && draft ? (
        <WeightsTab
          shape={data.shape} active={data.active} draft={draft} profile={profile} onProfile={setProfile}
          counts={data.companiesByProfile ?? {}}
          onWeight={setWeight} onFactor={setFactor} onBand={setBand} onFloor={setFloor}
          profileTotal={profileTotal} factorTotal={factorTotal} balanced={balanced} dirty={dirty} canEdit={canEdit} busy={busy}
          preview={preview} onPreview={runPreview}
          onReset={() => { setDraft(draftOf(data.active)); setPreview(null); }}
          onDefaults={() => { setDraft(draftOf(data.shape.codeDefaults)); setPreview(null); }}
          onSave={() => setSaveOpen(true)}
        />
      ) : null}

      {tab === "history" && data ? (
        <HistoryTab
          sets={data.sets} counts={data.scoreCounts} canEdit={canEdit}
          open={openVersion} onOpen={(v) => setOpenVersion(openVersion === v ? null : v)}
          compare={compare} onCompare={setCompare} onRevert={setRevert}
        />
      ) : null}

      {saveOpen && data && draft ? (
        <SaveDialog current={data.active.version} taken={data.sets.map((s) => s.version)} diff={preview?.diff ?? []} impact={preview?.impact ?? null} busy={busy} onCancel={() => setSaveOpen(false)} onSave={doSave} />
      ) : null}
      {revert ? <RevertDialog entry={revert} busy={busy} onCancel={() => setRevert(null)} onRevert={doRevert} /> : null}
    </div>
  );
}

/* ── Weights tab ───────────────────────────────────────────────────────── */

function WeightsTab(p: {
  shape: Shape; active: WeightSet; draft: Draft; profile: ProfileKey; onProfile: (k: ProfileKey) => void;
  /** Companies per profile — who a weight change would actually reach. */
  counts: Record<string, number>;
  onWeight: (p: ProfileKey, d: Dimension, v: number) => void; onFactor: (k: string, v: number) => void;
  onBand: (k: keyof Bands, v: number) => void; onFloor: (p: ProfileKey, v: number) => void;
  profileTotal: number; factorTotal: number; balanced: boolean; dirty: boolean; canEdit: boolean; busy: boolean;
  preview: { impact: ImpactSnapshot | null; errors: string[]; diff: DiffRow[] } | null;
  onPreview: () => void; onReset: () => void; onDefaults: () => void; onSave: () => void;
}) {
  const dimTotals = Object.fromEntries(p.shape.dimensions.map((d) => [d.key, sum(p.shape.factors.filter((f) => f.dimension === d.key).map((f) => p.draft.factors[f.key] ?? 0))])) as Record<Dimension, number>;
  const was = p.active.profiles[p.profile] ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-slate-500">Profile</span>
        {p.shape.profiles.map((x) => (
          <button key={x.key} type="button" onClick={() => p.onProfile(x.key)} className={x.key === p.profile ? btnPri : btn}>
            {x.label}{x.key === "seriesA_institutional" ? <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10.5px]">investor-facing</span> : null}
          </button>
        ))}
        <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-[11.5px] text-slate-600">Active {p.active.version}{p.active.createdAt ? ` · ${fmtAt(p.active.createdAt)}` : ""}</span>
      </div>

      {/* Which founders are scored with which profile — the mapping is what the
          code already does (companies.funding_stage → normalizeFundingStage →
          stageToProfile); saying it out loud is what was missing. */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo-600">Which founders are scored with which profile</p>
        <table className="w-full text-[12.5px]">
          <tbody className="divide-y divide-slate-100">
            {p.shape.profiles.map((x) => (
              <tr key={x.key} className={x.key === p.profile ? "bg-indigo-50/40" : undefined}>
                <td className="w-[120px] py-1.5 pl-1 font-semibold text-slate-900">{x.label}</td>
                <td className="w-[22px] py-1.5 text-center text-slate-400">→</td>
                <td className="py-1.5 text-slate-700">
                  {x.round}
                  {x.key === "seriesA_institutional" ? (
                    <span className="text-slate-400"> · also the single profile every investor-facing screen uses, so companies stay comparable</span>
                  ) : null}
                </td>
                <td className="w-[110px] py-1.5 pr-1 text-right">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {p.counts[x.key] ?? 0} {(p.counts[x.key] ?? 0) === 1 ? "company" : "companies"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11.5px] text-slate-500">
          Taken from each company&rsquo;s <b>Funding stage</b>. A founder who has not set one is scored as Seed.
          Change a company&rsquo;s stage and its score moves to that profile at the next re-score. Founders see their own
          stage profile; investor-facing screens read Series A for everyone.
        </p>
      </div>

      <div className={card}>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11px] text-slate-500"><th className="px-4 py-2 font-medium">Dimension</th><th className="py-2 font-medium">Factors it rolls up</th><th className="py-2 font-medium">Now</th><th className="py-2 text-right font-medium">Weight</th><th className="py-2 font-medium">Proposed</th><th className="py-2 pr-4 text-right font-medium">Change</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {p.shape.dimensions.map((d) => {
              const before = (was as Record<string, number>)[d.key] ?? 0;
              const after = p.draft.profiles[p.profile]?.[d.key] ?? 0;
              return (
                <tr key={d.key}>
                  <td className="px-4 py-2 font-medium text-slate-900">{d.label}</td>
                  <td className="py-2 text-[11.5px] text-slate-500">{p.shape.factors.filter((f) => f.dimension === d.key).map((f) => f.label).join(" · ") || "—"}</td>
                  <td className="py-2"><Bar pct={before} muted /></td>
                  <td className="py-2 text-right"><input type="number" min={0} max={100} disabled={!p.canEdit} value={after} onChange={(e) => p.onWeight(p.profile, d.key, Number(e.target.value))} className={`${num} ${after !== before ? "border-indigo-500 bg-indigo-50 font-semibold" : "border-slate-300"}`} aria-label={`${d.label} weight`} /></td>
                  <td className="py-2"><Bar pct={after} /></td>
                  <td className="py-2 pr-4 text-right tabular-nums"><Delta n={after - before} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={`m-3 rounded-lg px-3 py-2 text-[13px] font-semibold ${p.profileTotal === 100 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {p.profileTotal === 100 ? "✓ Total 100 — balanced" : `Total ${p.profileTotal} — must be exactly 100`}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={card}>
          <p className="border-b border-slate-100 px-4 py-2.5 text-[12.5px] font-semibold text-slate-900">Factor points <span className="font-normal text-slate-500">— the maxima the engine scores against, before profile weighting</span></p>
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-slate-100">
              {p.shape.factors.map((f) => {
                const before = p.active.factors[f.key as keyof WeightSet["factors"]] ?? 0;
                const after = p.draft.factors[f.key] ?? 0;
                return (
                  <tr key={f.key}>
                    <td className="px-4 py-1.5">{f.label}</td>
                    <td className="py-1.5 text-[11px] text-slate-500">{p.shape.dimensions.find((d) => d.key === f.dimension)?.label}</td>
                    <td className="py-1.5"><Bar pct={after * 5} /></td>
                    <td className="py-1.5 pr-4 text-right"><input type="number" min={0} max={100} disabled={!p.canEdit} value={after} onChange={(e) => p.onFactor(f.key, Number(e.target.value))} className={`${num} ${after !== before ? "border-indigo-500 bg-indigo-50 font-semibold" : "border-slate-300"}`} aria-label={f.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={`m-3 rounded-lg px-3 py-2 text-[13px] font-semibold ${p.factorTotal === 100 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
            {p.factorTotal === 100 ? "✓ Total 100 — balanced" : `Total ${p.factorTotal} — must be exactly 100`}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className={`${card} p-4`}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dimension totals</p>
            <table className="w-full text-[12.5px]"><tbody>{p.shape.dimensions.map((d) => <tr key={d.key}><td className="py-1">{d.label}</td><td className="py-1 text-right tabular-nums text-slate-600">{dimTotals[d.key]} pts</td></tr>)}</tbody></table>
          </div>
          <div className={`${card} p-4`}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bands</p>
            <table className="w-full text-[12.5px]"><tbody>
              {(["strong", "solid", "developing"] as const).map((k) => (
                <tr key={k}><td className="py-1 capitalize">{k}</td><td className="py-1 text-right"><input type="number" min={0} max={100} disabled={!p.canEdit} value={p.draft.bands[k]} onChange={(e) => p.onBand(k, Number(e.target.value))} className={`${num} border-slate-300`} aria-label={`${k} band`} /> +</td></tr>
              ))}
              <tr><td className="py-1">Early</td><td className="py-1 text-right text-slate-500">below {p.draft.bands.developing}</td></tr>
            </tbody></table>
            <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Traction floor · {p.shape.profiles.find((x) => x.key === p.profile)?.label}</p>
            <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
              <input type="number" min={0} max={100} disabled={!p.canEdit} value={p.draft.floors[p.profile]?.minTraction ?? 0} onChange={(e) => p.onFloor(p.profile, Number(e.target.value))} className={`${num} border-slate-300`} aria-label="Traction floor" />
              <span>below this, the band is capped at Developing however high the total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={!p.dirty} onClick={p.onReset}>Reset to saved</button>
        <button type="button" className={btn} disabled={!p.canEdit} onClick={p.onDefaults}>Restore code defaults</button>
        <button type="button" className={`${btn} ml-auto`} disabled={p.busy || !p.balanced} onClick={p.onPreview}>{p.busy ? "Working…" : "Preview impact"}</button>
        <button type="button" className={btnPri} disabled={!p.canEdit || !p.dirty || !p.balanced} onClick={p.onSave}>Save new version…</button>
      </div>
      {!p.canEdit ? <p className="text-[12px] text-slate-500">You can look but not change — saving weights is admin-only.</p> : null}

      {p.preview?.errors.length ? <ul className="list-disc rounded-lg border border-rose-200 bg-rose-50 px-6 py-3 text-[12.5px] text-rose-700">{p.preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
      {p.preview?.impact ? <ImpactTable impact={p.preview.impact} title="Preview — nothing saved yet" /> : null}
    </div>
  );
}

function ImpactTable({ impact, title }: { impact: ImpactSnapshot; title: string }) {
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-800">Draft</span>
        <span className="ml-auto text-[12.5px] text-slate-600">{impact.companies} scored · avg {impact.avgBefore} → {impact.avgAfter} · {impact.bandChanges} change band · {impact.gateUnlocks} unlock, {impact.gateLocks} lock outreach</span>
      </div>
      <table className="w-full text-[12.5px]">
        <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-4 py-2 font-medium">Company</th><th className="py-2 text-right font-medium">Now</th><th className="py-2 text-right font-medium">After</th><th className="py-2 text-right font-medium">Change</th><th className="py-2 font-medium">Band</th><th className="py-2 pr-4 font-medium">Outreach gate</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {impact.rows.map((r) => (
            <tr key={r.companyId}>
              <td className="px-4 py-1.5 text-slate-900">{r.company}{r.hasOverride ? <span className="ml-2 rounded bg-slate-100 px-1.5 text-[10.5px] text-slate-600">override</span> : null}</td>
              <td className="py-1.5 text-right tabular-nums">{r.before}</td><td className="py-1.5 text-right tabular-nums">{r.after}</td>
              <td className="py-1.5 text-right tabular-nums"><Delta n={r.delta} /></td>
              <td className="py-1.5 text-slate-600">{r.bandBefore === r.bandAfter ? r.bandBefore : `${r.bandBefore} → ${r.bandAfter}`}</td>
              <td className="py-1.5 pr-4">{r.gate === "unlocks" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">unlocks</span> : r.gate === "locks" ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">locks</span> : "—"}</td>
            </tr>
          ))}
          {impact.rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-400">No scored companies yet — nothing would move.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/* ── History tab ───────────────────────────────────────────────────────── */

function HistoryTab(p: {
  sets: HistoryEntry[]; counts: Record<string, number>; canEdit: boolean;
  open: string | null; onOpen: (v: string) => void;
  compare: { a: string; b: string } | null; onCompare: (c: { a: string; b: string } | null) => void;
  onRevert: (e: HistoryEntry) => void;
}) {
  const byVersion = useMemo(() => new Map(p.sets.map((s) => [s.version, s])), [p.sets]);
  const cmp = p.compare ? { a: byVersion.get(p.compare.a), b: byVersion.get(p.compare.b) } : null;
  const cmpRows = cmp?.a && cmp?.b ? diffLocal(cmp.a, cmp.b) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-slate-500">Compare</span>
        <select value={p.compare?.a ?? ""} onChange={(e) => p.onCompare({ a: e.target.value, b: p.compare?.b ?? p.sets[0]?.version ?? "" })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]">
          <option value="">—</option>{p.sets.map((s) => <option key={s.version} value={s.version}>{s.version}</option>)}
        </select>
        <span className="text-[12.5px] text-slate-500">with</span>
        <select value={p.compare?.b ?? ""} onChange={(e) => p.onCompare({ a: p.compare?.a ?? p.sets[p.sets.length - 1]?.version ?? "", b: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]">
          <option value="">—</option>{p.sets.map((s) => <option key={s.version} value={s.version}>{s.version}</option>)}
        </select>
        {p.compare ? <button type="button" className={btn} onClick={() => p.onCompare(null)}>Clear</button> : null}
      </div>

      {cmp?.a && cmp?.b ? (
        <div className={card}>
          <p className="border-b border-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-900">{cmp.a.version} → {cmp.b.version} <span className="ml-2 font-normal text-slate-500">{cmpRows.length} change{cmpRows.length === 1 ? "" : "s"}</span></p>
          <table className="w-full text-[12.5px]">
            <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-4 py-2 font-medium">Section</th><th className="py-2 font-medium">Setting</th><th className="py-2 text-right font-medium">{cmp.a.version}</th><th className="py-2 text-right font-medium">{cmp.b.version}</th><th className="py-2 pr-4 text-right font-medium">Change</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cmpRows.map((r, i) => <tr key={i}><td className="px-4 py-1.5 text-slate-600">{r.section}</td><td className="py-1.5">{r.setting}</td><td className="py-1.5 text-right tabular-nums">{r.before}</td><td className="py-1.5 text-right tabular-nums">{r.after}</td><td className="py-1.5 pr-4 text-right tabular-nums"><Delta n={r.delta} /></td></tr>)}
              {cmpRows.length === 0 ? <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">Identical — every weight, band and floor matches.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={card}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="w-6 px-3 py-2"></th><th className="py-2 font-medium">Version</th><th className="py-2 font-medium">What changed</th><th className="py-2 font-medium">By</th><th className="py-2 font-medium">When</th><th className="py-2 text-right font-medium">Scores on it</th><th className="py-2 text-right font-medium">Avg impact</th><th className="py-2 pr-4"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {p.sets.map((s) => {
              const isOpen = p.open === s.version;
              return (
                <>
                  <tr key={s.version} className={isOpen ? "bg-indigo-50/30" : ""}>
                    <td className="px-3 py-2.5 align-top"><button type="button" onClick={() => p.onOpen(s.version)} aria-label="Toggle detail" className="text-slate-400">{isOpen ? "▾" : "▸"}</button></td>
                    <td className="py-2.5 align-top"><span className="font-semibold text-slate-900">{s.version}</span>{s.isActive ? <div><span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Active</span></div> : null}</td>
                    <td className="py-2.5 align-top"><p className="text-slate-800">{s.summary}</p>{s.reason ? <p className="mt-0.5 text-[12px] text-slate-500">{s.reason}</p> : null}</td>
                    <td className="py-2.5 align-top text-slate-600">{s.createdByName ?? (s.createdBy ? "Staff" : "System")}</td>
                    <td className="py-2.5 align-top text-slate-600">{fmtAt(s.createdAt)}</td>
                    <td className="py-2.5 text-right align-top tabular-nums">{p.counts[s.version] ?? 0}</td>
                    <td className="py-2.5 text-right align-top tabular-nums">{s.impact ? <span>{s.impact.avgBefore} → {s.impact.avgAfter} <Delta n={s.impact.avgAfter - s.impact.avgBefore} /></span> : <span className="text-slate-400">baseline</span>}</td>
                    <td className="py-2.5 pr-4 text-right align-top">{p.canEdit && !s.isActive ? <button type="button" className={btn} onClick={() => p.onRevert(s)}>Revert to this</button> : null}</td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${s.version}-detail`}>
                      <td colSpan={8} className="bg-slate-50/60 px-8 py-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className={`${card} p-3`}>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Weight diff</p>
                            {s.diff.length === 0 ? <p className="text-[12.5px] text-slate-400">Baseline version — nothing before it to compare.</p> : (
                              <table className="w-full text-[12.5px]"><tbody className="divide-y divide-slate-100">
                                {s.diff.map((r, i) => <tr key={i}><td className="py-1 text-slate-600">{r.section}</td><td className="py-1">{r.setting}</td><td className="py-1 text-right tabular-nums">{r.before} → <b>{r.after}</b></td><td className="py-1 pr-1 text-right"><Delta n={r.delta} /></td></tr>)}
                              </tbody></table>
                            )}
                          </div>
                          <div>
                            {s.impact ? (
                              <>
                                <div className="mb-3 grid grid-cols-3 gap-3">
                                  <div className={`${card} p-3`}><p className="text-[19px] font-semibold tabular-nums">{s.impact.companies}</p><p className="text-[11px] text-slate-500">companies re-scored</p></div>
                                  <div className={`${card} p-3`}><p className="text-[19px] font-semibold tabular-nums">{s.impact.bandChanges}</p><p className="text-[11px] text-slate-500">changed band</p></div>
                                  <div className={`${card} p-3`}><p className="text-[19px] font-semibold tabular-nums">{s.impact.gateUnlocks + s.impact.gateLocks}</p><p className="text-[11px] text-slate-500">crossed the gate</p></div>
                                </div>
                                <div className={`${card} p-3`}>
                                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Who moved</p>
                                  <table className="w-full text-[12.5px]"><tbody className="divide-y divide-slate-100">
                                    {s.impact.rows.slice(0, 8).map((r) => <tr key={r.companyId}><td className="py-1">{r.company}</td><td className="py-1 text-right tabular-nums">{r.before} → {r.after}</td><td className="py-1 pr-1 text-right"><Delta n={r.delta} /></td><td className="py-1 text-right">{r.gate === "unlocks" ? <span className="rounded-full bg-emerald-50 px-2 text-[10.5px] text-emerald-700">unlocked</span> : r.gate === "locks" ? <span className="rounded-full bg-rose-50 px-2 text-[10.5px] text-rose-700">locked</span> : null}</td></tr>)}
                                  </tbody></table>
                                </div>
                              </>
                            ) : <p className="text-[12.5px] text-slate-400">No impact recorded for this version.</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-slate-500">“Scores on it” counts companies whose current score still carries that version stamp — a score from August stays interpretable because you can see which weights produced it.</p>
    </div>
  );
}

/** Client-side diff for Compare (same rules as the server's diffSets). */
function diffLocal(a: WeightSet, b: WeightSet): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const p of Object.keys(a.profiles) as ProfileKey[]) {
    for (const d of Object.keys(a.profiles[p] ?? {}) as Dimension[]) {
      const before = a.profiles[p]?.[d] ?? 0, after = b.profiles[p]?.[d] ?? 0;
      if (before !== after) rows.push({ section: `Profile · ${p}`, setting: d, before, after, delta: after - before });
    }
  }
  for (const k of Object.keys(a.factors) as Array<keyof WeightSet["factors"]>) {
    const before = a.factors[k] ?? 0, after = b.factors[k] ?? 0;
    if (before !== after) rows.push({ section: "Factor points", setting: String(k), before, after, delta: after - before });
  }
  for (const k of ["strong", "solid", "developing"] as const) {
    if (a.bands[k] !== b.bands[k]) rows.push({ section: "Bands", setting: k, before: a.bands[k], after: b.bands[k], delta: b.bands[k] - a.bands[k] });
  }
  return rows;
}

/* ── Dialogs ───────────────────────────────────────────────────────────── */

function SaveDialog({ current, taken, diff, impact, busy, onCancel, onSave }: { current: string; taken: string[]; diff: DiffRow[]; impact: ImpactSnapshot | null; busy: boolean; onCancel: () => void; onSave: (version: string, reason: string, rescore: boolean) => void }) {
  const suggested = useMemo(() => {
    const m = /^(.*?)(\d+)$/.exec(current);
    const stem = m ? m[1] : `${current}-v`;
    let n = m ? Number(m[2]) + 1 : 2;
    while (taken.includes(`${stem}${n}`)) n++;
    return `${stem}${n}`;
  }, [current, taken]);
  const [version, setVersion] = useState(suggested);
  const [reason, setReason] = useState("");
  const [rescore, setRescore] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Save new weight version">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-slate-950">Save new weight version</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">{diff.length ? diff.map((d) => `${d.setting} ${d.before}→${d.after}`).join(", ") : "Run Preview impact first to record what this changes."}</p>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Version name
          <input value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px]" />
        </label>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why (recorded, shown in History)
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Traction matters more than team pedigree at A" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px]" />
        </label>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Apply to</p>
        <label className="mt-1 flex gap-2 text-[12.5px]"><input type="radio" checked={!rescore} onChange={() => setRescore(false)} /><span>Save only — new scores use it; existing companies keep their current numbers</span></label>
        <label className="mt-1 flex gap-2 text-[12.5px]"><input type="radio" checked={rescore} onChange={() => setRescore(true)} /><span>Save and re-score {impact?.companies ?? "all"} companies now <span className="text-slate-500">(arithmetic only, no AI cost)</span></span></label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onCancel}>Cancel</button>
          <button type="button" className={btnPri} disabled={busy || !reason.trim() || !version.trim()} onClick={() => onSave(version.trim(), reason.trim(), rescore)}>{busy ? "Saving…" : "Save version"}</button>
        </div>
      </div>
    </div>
  );
}

function RevertDialog(p: { entry: HistoryEntry; busy: boolean; onCancel: () => void; onRevert: (e: HistoryEntry, reason: string, rescore: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [rescore, setRescore] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Revert weights">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-slate-950">Revert to {p.entry.version}</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">Copies that version&rsquo;s numbers forward as a new version. {p.entry.version} and everything after it stay in the history.</p>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why (recorded)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px]" />
        </label>
        <label className="mt-3 flex gap-2 text-[12.5px]"><input type="checkbox" checked={rescore} onChange={(e) => setRescore(e.target.checked)} /><span>Re-score every company now</span></label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={p.onCancel}>Cancel</button>
          <button type="button" className={btnPri} disabled={p.busy || !reason.trim()} onClick={() => p.onRevert(p.entry, reason.trim(), rescore)}>{p.busy ? "Reverting…" : "Revert"}</button>
        </div>
      </div>
    </div>
  );
}
