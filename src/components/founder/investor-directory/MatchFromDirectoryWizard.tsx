"use client";

/**
 * Founder › My contacts › "Match from directory" wizard.
 * Criteria → Matches → Plan space → Done. Reuses the Investor directory API
 * (filters, select all ids, plan limits, terms) and its import endpoint, so
 * limits, duplicates and the terms of use behave exactly as in the directory.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useVocabulary } from "@/lib/vocabulary/provider";
import type { DirectoryTier, FounderDirectoryAccess } from "@/lib/investor-directory/types";
import type { VocabularyOption } from "@/lib/vocabulary/lists";
import { splitProfileCsv } from "@/lib/profile/options";

type Row = {
  id: string; firm: string; contact_name: string | null; city: string | null; state: string | null;
  investor_types: string[]; funding_stages: string[]; industries: string[]; hasEmail: boolean; held: boolean;
};
type Payload = {
  rows: Row[]; total: number; page: number; pageSize: number; access: FounderDirectoryAccess; tiers: DirectoryTier[];
  settings: { require_terms: boolean; daily_cap: number; allow_export: boolean; terms_version: number };
};
type Picks = { type: string[]; stage: string[]; industry: string[]; hasEmail: boolean; investingNow: boolean };

const STEPS = ["Criteria", "Matches", "Plan space", "Done"];

/** Company profile values the Criteria step can start from (Import my matches). */
export type DirectoryDefaults = { industry?: string | null; fundingStage?: string | null; investorTypes?: string | null };

/** Profile answers are stored as a slug or a label; keep the ones this list knows. */
function toSlugs(all: VocabularyOption[], values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const hit = all.find((o) => o.slug === v || o.label.toLowerCase() === v.toLowerCase());
    if (hit && !out.includes(hit.slug)) out.push(hit.slug);
  }
  return out;
}
const n = (v: number) => v.toLocaleString("en-US");

function Chips({ options, value, onChange }: Readonly<{ options: { slug: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.slug);
        return (
          <button
            key={o.slug}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.slug) : [...value, o.slug])}
            className={`rounded-full border px-3 py-1 text-[12.5px] ${on ? "border-[#1A6CE4] bg-[#E6F1FB] font-semibold text-[#0C447C]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MatchFromDirectoryWizard({ onClose, onImported, defaults }: Readonly<{ onClose: () => void; onImported: () => void; defaults?: DirectoryDefaults }>) {
  const types = useVocabulary("investor_type");
  const stages = useVocabulary("funding_stage");
  const industries = useVocabulary("industry");

  const [step, setStep] = useState(1);
  const [picks, setPicks] = useState<Picks>(() => ({
    type: toSlugs(types.all, splitProfileCsv(defaults?.investorTypes)),
    stage: toSlugs(stages.all, defaults?.fundingStage ? [defaults.fundingStage] : []),
    industry: toSlugs(industries.all, defaults?.industry ? [defaults.industry] : []),
    hasEmail: true,
    investingNow: false,
  }));
  // Only claim "from your profile" when something actually carried over.
  const [fromProfile] = useState(() => picks.type.length + picks.stage.length + picks.industry.length > 0);
  const [data, setData] = useState<Payload | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [capped, setCapped] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [agree, setAgree] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; alreadyHeld: number; trimmedBy?: string } | null>(null);

  const query = useCallback((p: number, ids = false) => {
    const q = new URLSearchParams();
    for (const v of picks.type) q.append("type", v);
    for (const v of picks.stage) q.append("stage", v);
    for (const v of picks.industry) q.append("industry", v);
    if (picks.hasEmail) q.set("hasEmail", "1");
    if (picks.investingNow) q.set("investingNow", "1");
    if (p > 1) q.set("page", String(p));
    if (ids) q.set("ids", "1");
    return q;
  }, [picks]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/founder/investor-directory?${query(p)}`);
      const body = (await res.json().catch(() => ({}))) as Payload & { error?: string };
      if (!res.ok) { setError(body.error ?? "Couldn't load matches."); return; }
      setData(body);
      setPage(p);
    } catch {
      setError("Couldn't load matches.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Plan numbers are needed on step 3 even if the founder skipped ahead, so load once on open.
  useEffect(() => {
    let live = true;
    void fetch(`/api/founder/investor-directory?${query(1)}`)
      .then((res) => res.json().then((body: Payload & { error?: string }) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!live) return;
        if (ok) setData(body);
        else setError(body.error ?? "Couldn't load matches.");
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setError("Couldn't load matches.");
        setLoading(false);
      });
    return () => { live = false; };
    // Runs once on open; later searches go through load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const access = data?.access;
  const limits = access?.limits;
  const contactLimit = limits?.contacts ?? 0;
  const browseOnly = !access || contactLimit <= 0;
  const heldLeft = access ? Math.max(0, contactLimit - access.held) : 0;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const selectable = rows.filter((r) => !r.held);
  const pageAll = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 80;
  const overBy = !browseOnly && selected.size > heldLeft ? selected.size - heldLeft : 0;
  const needTerms = !!data?.settings.require_terms && !!access && !access.termsAccepted;
  const usedPct = contactLimit > 0 ? Math.min(100, Math.round(((access?.held ?? 0) / contactLimit) * 100)) : 0;

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const res = await fetch(`/api/founder/investor-directory?${query(1, true)}`);
      const body = (await res.json().catch(() => ({}))) as { ids?: string[]; formd?: string[]; error?: string };
      if (!res.ok || !body.ids) { setError(body.error ?? "Couldn't select every match."); return; }
      const formd = new Set(body.formd ?? []);
      const counted = body.ids.filter((id) => !formd.has(id));
      const keep = new Set(counted.slice(0, heldLeft));
      const ids = body.ids.filter((id) => formd.has(id) || keep.has(id));
      setSelected(new Set(ids));
      setCapped(ids.length < body.ids.length);
    } finally {
      setSelectingAll(false);
    }
  }

  async function runImport() {
    if (!data || !access) return;
    setImporting(true);
    setError(null);
    try {
      if (needTerms) {
        if (!agree) { setError("Check the box to agree to the directory terms."); return; }
        const t = await fetch("/api/founder/investor-directory/terms", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true }),
        });
        if (!t.ok) { const b = (await t.json().catch(() => ({}))) as { error?: string }; setError(b.error ?? "Couldn't save the terms. Try again."); return; }
      }
      const res = await fetch("/api/founder/investor-directory/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected] }),
      });
      const body = (await res.json().catch(() => ({}))) as { imported?: number; alreadyHeld?: number; trimmedBy?: string; error?: string };
      if (!res.ok) { setError(body.error ?? "Couldn't import those investors."); return; }
      setResult({ imported: body.imported ?? 0, alreadyHeld: body.alreadyHeld ?? 0, trimmedBy: body.trimmedBy });
      setStep(4);
      onImported();
    } finally {
      setImporting(false);
    }
  }

  function next() {
    setError(null);
    if (step === 1) { setSelected(new Set()); setCapped(false); void load(1); setStep(2); return; }
    if (step === 2) { if (selected.size === 0) { setError("Tick at least one investor."); return; } setStep(3); return; }
    if (step === 3) void runImport();
  }

  const btn = "rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold";
  const primary = `${btn} bg-[#1A6CE4] text-white hover:bg-[#2E78F5] disabled:opacity-50`;
  const ghost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Match investors from the directory" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <i className="ti ti-sparkles text-[18px] text-[#1A6CE4]" aria-hidden="true" />
          <h2 className="flex-1 text-[15px] font-semibold text-slate-900">Match from directory</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        <ol className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-2.5 text-[12.5px]">
          {STEPS.map((s, i) => {
            const num = i + 1;
            const state = num === step ? "act" : num < step ? "done" : "todo";
            return (
              <li key={s} className={`flex min-w-[110px] flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 ${state === "act" ? "border-[#1A6CE4] bg-[#E6F1FB]" : "border-slate-200"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${state === "todo" ? "bg-slate-200 text-slate-600" : state === "done" ? "bg-emerald-600 text-white" : "bg-[#1A6CE4] text-white"}`}>{state === "done" ? "✓" : num}</span>
                {s}
              </li>
            );
          })}
        </ol>

        <div className="px-4 py-4 text-[13px]">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-slate-500">Choose who you want. Leave a group empty to include everyone in it.</p>
              {fromProfile ? <p className="rounded-lg bg-[#E6F1FB] px-3 py-2 text-[12.5px] text-[#0C447C]">Pre-filled from your company profile. Change anything you like.</p> : null}
              <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Investor type</p><Chips options={types.options} value={picks.type} onChange={(v) => setPicks((p) => ({ ...p, type: v }))} /></div>
              <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stage</p><Chips options={stages.options} value={picks.stage} onChange={(v) => setPicks((p) => ({ ...p, stage: v }))} /></div>
              <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Industry</p><Chips options={industries.options} value={picks.industry} onChange={(v) => setPicks((p) => ({ ...p, industry: v }))} /></div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={picks.hasEmail} onChange={(e) => setPicks((p) => ({ ...p, hasEmail: e.target.checked }))} /> Has an email</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={picks.investingNow} onChange={(e) => setPicks((p) => ({ ...p, investingNow: e.target.checked }))} /> Investing now</label>
              </div>
              <p className="rounded-lg bg-[#E6F1FB] px-3 py-2 text-[12px] text-[#0C447C]">The directory is public investor data compiled by iCFO, outside the iCFO network. It updates constantly.</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              {loading ? <p className="py-8 text-center text-slate-500">Finding matches…</p> : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-slate-800">{n(total)} investor{total === 1 ? "" : "s"} match</span>
                    {!browseOnly && total > selected.size && !capped ? (
                      <button type="button" disabled={selectingAll} onClick={() => void selectAllMatching()} className="text-[12.5px] text-[#185FA5] hover:underline disabled:opacity-60">
                        {selectingAll ? "Selecting…" : `Select all ${n(total)} matching`}
                      </button>
                    ) : null}
                    {capped ? <span className="text-[12px] text-[#8A5300]">The first {n(selected.size)}, all your plan has room for</span> : null}
                    <span className="flex-1" />
                    <span className="text-[12px] text-slate-500">{n(selected.size)} selected</span>
                  </div>
                  {rows.length === 0 ? <p className="py-8 text-center text-slate-500">No investors match. Go back and loosen a filter.</p> : (
                    <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-slate-200">
                      <table className="w-full text-[12.5px]">
                        <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="w-9 px-3 py-2">
                              <input type="checkbox" aria-label="Select all on this page" checked={pageAll} onChange={() => setSelected((s) => { const x = new Set(s); for (const r of selectable) { if (pageAll) x.delete(r.id); else x.add(r.id); } return x; })} />
                            </th>
                            <th className="px-2 py-2 font-medium">Investor</th>
                            <th className="hidden px-2 py-2 font-medium sm:table-cell">Type</th>
                            <th className="hidden px-2 py-2 font-medium sm:table-cell">Focus</th>
                            <th className="px-2 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{r.held ? <i className="ti ti-check text-[#27500A]" aria-label="Already in contacts" /> : <input type="checkbox" aria-label={`Select ${r.firm}`} checked={selected.has(r.id)} onChange={() => setSelected((s) => { const x = new Set(s); if (x.has(r.id)) x.delete(r.id); else x.add(r.id); return x; })} />}</td>
                              <td className="px-2 py-2"><div className="font-medium text-slate-900">{r.firm}</div><div className="text-[11.5px] text-slate-500">{[r.contact_name, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div></td>
                              <td className="hidden px-2 py-2 text-slate-600 sm:table-cell">{r.investor_types.map(types.label).join(", ") || "—"}</td>
                              <td className="hidden px-2 py-2 text-slate-600 sm:table-cell">{[...r.funding_stages.map(stages.label), ...r.industries.map(industries.label)].slice(0, 3).join(", ") || "—"}</td>
                              <td className="px-2 py-2">{r.held ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Already in contacts</span> : <span className="text-slate-500">New</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {total > pageSize ? (
                    <div className="flex items-center justify-end gap-2 text-[12px] text-slate-500">
                      <button type="button" className={ghost} disabled={page <= 1} onClick={() => void load(page - 1)}>Prev</button>
                      <span>{(page - 1) * pageSize + 1}-{Math.min(total, page * pageSize)} / {n(total)}</span>
                      <button type="button" className={ghost} disabled={page * pageSize >= total} onClick={() => void load(page + 1)}>Next</button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              {browseOnly ? (
                <div className="rounded-lg bg-slate-50 px-3 py-3">Your plan lets you browse the directory. Basic and up let you add investors. <Link href="/upgrade" className="font-semibold text-[#185FA5] underline">See plans</Link></div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <div className="flex justify-between text-[12px]"><span className="text-slate-500">{limits?.planLabel} plan</span><span className="font-medium tabular-nums">{n(access?.held ?? 0)} / {n(contactLimit)}</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-white"><div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${usedPct}%` }} /></div>
                      <p className="mt-1 text-[11.5px] text-slate-500">Holds up to {n(contactLimit)} investors. {n(heldLeft)} left.</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[12px] text-slate-500">This import</p>
                      <p className="text-[15px] font-semibold text-slate-900">{n(selected.size)} investor{selected.size === 1 ? "" : "s"} selected</p>
                      <p className="text-[11.5px] text-slate-500">Investors already in your contacts are skipped.</p>
                    </div>
                  </div>
                  {overBy > 0 ? <p className="rounded-md bg-[#FCEBEB] px-3 py-2 text-[12.5px] text-[#791F1F]">Your plan has room for {n(heldLeft)} more. Go back and untick {n(overBy)}, or <Link href="/upgrade" className="font-semibold underline">upgrade</Link>.</p> : null}
                  {needTerms ? (
                    <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                      <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                      <span>I agree to use directory data for my own company&apos;s fundraising only and not to redistribute it.</span>
                    </label>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 4 && result ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[22px] text-emerald-700">✓</div>
              <h3 className="text-[16px] font-semibold text-slate-900">{n(result.imported)} investor{result.imported === 1 ? "" : "s"} added to My contacts</h3>
              <p className="mt-1 text-slate-500">
                They are under &ldquo;From investor directory&rdquo;.
                {result.alreadyHeld ? ` ${n(result.alreadyHeld)} already in your list.` : ""}
                {result.trimmedBy === "hold_limit" ? " The rest didn't fit your plan." : ""}
                {result.trimmedBy === "daily_cap" ? " The rest are over today's limit." : ""}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" className={primary} onClick={onClose}>Back to My contacts</button>
                <Link href="/founder/deploy?step=outreach&mode=manual" className={ghost}>Open Manual outreach</Link>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 rounded-md bg-[#FCEBEB] px-3 py-2 text-[12.5px] text-[#791F1F]" role="alert">{error}</p> : null}
        </div>

        {step < 4 ? (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            <button type="button" className={ghost} onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>{step === 1 ? "Cancel" : "Back"}</button>
            <button type="button" className={primary} disabled={loading || importing || (step === 3 && (browseOnly || overBy > 0))} onClick={next}>
              {step === 1 ? "Next: Review matches" : step === 2 ? "Next: Plan space" : importing ? "Importing…" : "Import into My contacts"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
