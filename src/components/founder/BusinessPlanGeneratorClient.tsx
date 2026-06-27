"use client";

import { useEffect, useMemo, useState } from "react";
import { BUSINESS_PLAN_SECTIONS, SECTION_GROUPS } from "@/lib/business-plan/sections";
import { ASSUMPTION_DEFS } from "@/lib/business-plan/assumptions";
import { computeProjections } from "@/lib/business-plan/projections";
import { checkAssumptions } from "@/lib/business-plan/sanity";
import type { ProjectionAssumptions, ProjectionResult } from "@/lib/business-plan/projections";
import type { BusinessPlan } from "@/lib/business-plan/types";

type SectionMap = BusinessPlan["sections"];
const PROJ_ID = "projections";

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

export function BusinessPlanGeneratorClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>(BUSINESS_PLAN_SECTIONS[0].id);
  const [sections, setSections] = useState<SectionMap>({});
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetch("/api/founder/business-plan")
      .then((r) => r.json())
      .then((j) => {
        if (!on) return;
        if (j.error) { setError(typeof j.error === "string" ? j.error : "Could not load."); return; }
        setStage((j.company?.stage as string | null) ?? null);
        setSections((j.plan?.sections as SectionMap) ?? {});
        const a = (j.plan?.assumptions && Object.keys(j.plan.assumptions).length ? j.plan.assumptions : j.defaultAssumptions) as ProjectionAssumptions;
        setAssumptions(a);
      })
      .catch(() => on && setError("Could not load your business plan."))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const projections: ProjectionResult | null = useMemo(
    () => (assumptions ? computeProjections(assumptions) : null),
    [assumptions],
  );

  const early = stage === "pre_revenue" || stage === "early_revenue" || stage == null;
  const visibleSections = useMemo(
    () => BUSINESS_PLAN_SECTIONS.filter((s) => showAll || !early || s.core),
    [showAll, early],
  );

  const sanityNotes = useMemo(
    () => (assumptions ? checkAssumptions(stage, assumptions, projections) : []),
    [stage, assumptions, projections],
  );

  const filledCount = useMemo(() => {
    let n = visibleSections.filter((s) => s.id !== PROJ_ID && (sections[s.id]?.content ?? "").trim().length > 0).length;
    if (assumptions && visibleSections.some((s) => s.id === PROJ_ID)) n += 1;
    return n;
  }, [sections, assumptions, visibleSections]);

  // Derive the effective section: if the selected one isn't visible (e.g. after
  // toggling depth), fall back to the first visible section — no effect needed.
  const activeId = visibleSections.some((s) => s.id === active) ? active : (visibleSections[0]?.id ?? active);

  function setContent(id: string, content: string) {
    setSections((prev) => ({ ...prev, [id]: { content, aiGenerated: false } }));
  }
  function setA(key: keyof ProjectionAssumptions, v: number) {
    setAssumptions((prev) => (prev ? { ...prev, [key]: v } : prev));
  }

  async function aiDraft(id: string) {
    setDrafting(id);
    setError(null);
    try {
      const url = id === "exec_summary" ? "/api/founder/business-plan/exec-summary" : "/api/founder/business-plan/draft";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: id === "exec_summary" ? undefined : JSON.stringify({ sectionId: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not draft.");
      if (j.content) setSections((prev) => ({ ...prev, [id]: { content: j.content as string, aiGenerated: Boolean(j.aiGenerated) } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft.");
    } finally {
      setDrafting(null);
    }
  }

  async function save(status?: "draft" | "finalized") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/business-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, assumptions, projections, ...(status ? { status } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save.");
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    await save();
    window.open("/api/founder/business-plan/pdf", "_blank", "noopener");
  }

  async function shareLink() {
    setShareMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/founder/business-plan/share", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create link.");
      await navigator.clipboard.writeText(j.url as string).catch(() => {});
      setShareMsg("Private link copied — view-only, expires in 14 days.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link.");
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    try {
      await save();
      const res = await fetch("/api/founder/business-plan/finalize", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not finalize.");
      setFinalized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finalize.");
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[var(--text-muted)]">Loading your plan…</p>;

  if (finalized) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-base font-semibold text-emerald-800">Plan finalized and saved to Documents</p>
        <p className="mt-1 text-sm text-emerald-700">
          Your business plan PDF is in your Documents and counts toward your readiness score. Our team can now review it.
        </p>
        <button onClick={() => setFinalized(false)} className="mt-4 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700">
          Keep editing
        </button>
      </div>
    );
  }

  const def = BUSINESS_PLAN_SECTIONS.find((s) => s.id === activeId)!;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{filledCount} / {visibleSections.length} sections done</div>
          <div className="mt-1 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--indigo)]" style={{ width: `${Math.round((filledCount / Math.max(1, visibleSections.length)) * 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-700">Saved {savedAt}</span>}
          <button onClick={() => save()} disabled={saving} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={downloadPdf} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">PDF</button>
          <button onClick={shareLink} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">Share link</button>
          <button onClick={finalize} disabled={finalizing} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
            {finalizing ? "Finalizing…" : "Finalize"}
          </button>
        </div>
      </div>
      {shareMsg && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{shareMsg}</div>}

      {error && <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 grid gap-4 md:grid-cols-[230px_1fr]">
        {/* Section nav */}
        <aside className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
          {SECTION_GROUPS.filter((g) => visibleSections.some((s) => s.group === g)).map((g) => (
            <div key={g} className="mb-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{g}</p>
              {visibleSections.filter((s) => s.group === g).map((s) => {
                const done = s.id === PROJ_ID ? Boolean(assumptions) : (sections[s.id]?.content ?? "").trim().length > 0;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition ${activeId === s.id ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]" : "text-[var(--text-secondary)] hover:bg-slate-50"}`}>
                    <span className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="flex-1">{s.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {early && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 w-full rounded-md border border-dashed border-[var(--border-subtle)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-slate-50"
            >
              {showAll ? "Show core sections only" : "Show all 15 sections"}
            </button>
          )}
        </aside>

        {/* Editor */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="text-base font-semibold text-[var(--navy)]">{def.title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{def.help}</p>

          {activeId === PROJ_ID ? (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ASSUMPTION_DEFS.map((d) => (
                  <label key={d.key} className="block">
                    <span className="text-xs text-[var(--text-secondary)]">{d.label}</span>
                    <input
                      type="number"
                      value={assumptions ? assumptions[d.key] : 0}
                      onChange={(e) => setA(d.key, Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm"
                    />
                  </label>
                ))}
              </div>
              {projections && (
                <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
                        <th className="px-3 py-2"></th><th className="px-3 py-2 text-right">Yr 1</th><th className="px-3 py-2 text-right">Yr 2</th><th className="px-3 py-2 text-right">Yr 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([["Revenue", "revenue"], ["Gross profit", "grossProfit"], ["Operating expense", "operatingExpense"], ["Net cash flow", "netCashFlow"]] as const).map(([label, key]) => (
                        <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="px-3 py-2 text-[var(--text-secondary)]">{label}</td>
                          {projections.years.map((y) => (
                            <td key={y.year} className="px-3 py-2 text-right">{money(y[key])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {projections.runwayMonths ? `Runway ≈ ${projections.runwayMonths} months` : "Cash-flow positive within 3 years"} · ending cash {money(projections.endingCash)}
                  </div>
                </div>
              )}
              {sanityNotes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sanityNotes.map((n, i) => (
                    <div key={i} className={`rounded-md border px-3 py-2 text-xs ${n.level === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]"}`}>
                      <span className="font-medium">AI check:</span> {n.text}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-[var(--text-muted)]">Illustrative projections based on your assumptions. Not a forecast, guarantee, or investment advice.</p>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => aiDraft(activeId)}
                  disabled={drafting === activeId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--indigo)] bg-[var(--indigo-soft)] px-3 py-1.5 text-xs font-medium text-[var(--indigo)] disabled:opacity-50"
                >
                  {drafting === activeId ? "Drafting…" : activeId === "exec_summary" ? "Write from my plan" : "Draft with AI"}
                </button>
                {sections[activeId]?.aiGenerated && (
                  <span className="text-xs text-[var(--text-muted)]">AI draft — edit to make it yours</span>
                )}
              </div>
              <textarea
                value={sections[activeId]?.content ?? ""}
                onChange={(e) => setContent(activeId, e.target.value)}
                rows={8}
                placeholder="Write this section in your own words — or let AI draft it from your profile."
                className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
