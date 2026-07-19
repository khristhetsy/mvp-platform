"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { summarize, modelRound } from "@/lib/cap-table/compute";
import type { Holder, HolderGroup, RoundModel } from "@/lib/cap-table/types";
import { FounderModulePreview, PreviewButton } from "./FounderModulePreview";

const GROUP_LABEL: Record<HolderGroup, string> = { founder: "Founder", pool: "Option pool", investor: "Investor" };
const SLICE_COLORS = ["#1D9E75", "#5DCAA5", "#9FE1CB", "#378ADD", "#85B7EB", "#2E78F5", "#D85A30", "#D4537E", "#BA7517"];

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function CapTableClient() {
  const t = useTranslations("founderCmp");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Your company");
  const [holders, setHolders] = useState<Holder[]>([]);
  const [round, setRound] = useState<RoundModel>({ newInvestment: 0, preMoney: 0 });
  const [modelOn, setModelOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let on = true;
    fetch("/api/founder/cap-table")
      .then((r) => r.json())
      .then((j) => {
        if (!on) return;
        if (j.error) { setError(typeof j.error === "string" ? j.error : "Could not load."); return; }
        setCompanyName(j.companyName ?? "Your company");
        setHolders((j.holders as Holder[]) ?? []);
        if (j.round) { setRound(j.round as RoundModel); setModelOn(true); }
      })
      .catch(() => on && setError("Could not load your cap table."))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const sum = useMemo(() => summarize(holders), [holders]);
  const dilution = useMemo(
    () => (modelOn ? modelRound(holders, round) : null),
    [modelOn, holders, round],
  );

  function update(id: string, patch: Partial<Holder>) {
    setHolders((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setSavedAt(null);
  }
  function addHolder() {
    setHolders((prev) => [
      ...prev,
      { id: `h-${Date.now()}`, name: "New holder", group: "investor", shareClass: "Preferred", shares: 0 },
    ]);
  }
  function removeHolder(id: string) {
    setHolders((prev) => prev.filter((h) => h.id !== id));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/cap-table", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holders, round: modelOn ? round : null }),
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

  async function exportAs(format: "xlsx" | "pdf") {
    setExporting(format);
    setError(null);
    setExportMsg(null);
    try {
      await save();
      const res = await fetch("/api/founder/cap-table/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not export.");
      setExportMsg(`Saved ${j.fileName as string} to your Documents — counts toward readiness and the Qualify stage.`);
      if (j.url) window.open(j.url as string, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setExporting(null);
    }
  }

  const colorFor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];
  const circ = 2 * Math.PI * 46;
  // Precompute cumulative dash offsets so we never reassign during render.
  const donutSlices = useMemo(
    () =>
      sum.rows.map((row, i) => ({
        id: row.holder.id,
        color: colorFor(i),
        len: row.pct * circ,
        offset: sum.rows.slice(0, i).reduce((a, r) => a + r.pct, 0) * circ,
      })),
    [sum.rows, circ],
  );

  if (loading) return <p className="mt-6 text-sm text-[var(--text-muted)]">{t("loading_your_cap_table")}</p>;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{companyName} — cap table</span>
        <div className="flex flex-wrap items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-700">Saved {savedAt}</span>}
          <PreviewButton onClick={() => setPreview(true)} />
          <button onClick={save} disabled={saving} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => exportAs("xlsx")} disabled={exporting !== null} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">
            {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
          </button>
          <button onClick={() => exportAs("pdf")} disabled={exporting !== null} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {exportMsg && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{exportMsg}</div>}
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        {/* Holders editor */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--navy)]">{t("shareholders")}</h2>
            <button onClick={addHolder} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--indigo)]">+ Add holder</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="px-2 py-1 font-normal">Holder</th>
                  <th className="px-2 py-1 font-normal">Group</th>
                  <th className="px-2 py-1 font-normal">Class</th>
                  <th className="px-2 py-1 text-right font-normal">Shares</th>
                  <th className="px-2 py-1 text-right font-normal">FD %</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {sum.rows.map((row, i) => (
                  <tr key={row.holder.id} className="border-t border-[var(--border-subtle)]">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 flex-none rounded-sm" style={{ background: colorFor(i) }} />
                        <input value={row.holder.name} onChange={(e) => update(row.holder.id, { name: e.target.value })} className="w-full min-w-[7rem] rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.holder.group} onChange={(e) => update(row.holder.id, { group: e.target.value as HolderGroup })} className="rounded border border-[var(--border-subtle)] px-1.5 py-1 text-xs">
                        {(["founder", "pool", "investor"] as HolderGroup[]).map((g) => (
                          <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.holder.shareClass} onChange={(e) => update(row.holder.id, { shareClass: e.target.value })} className="w-24 rounded border border-[var(--border-subtle)] px-2 py-1 text-sm" />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} value={row.holder.shares} onChange={(e) => update(row.holder.id, { shares: Math.max(0, Number(e.target.value) || 0) })} className="w-28 rounded border border-[var(--border-subtle)] px-2 py-1 text-right text-sm tabular-nums" />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">{pct(row.pct)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => removeHolder(row.holder.id)} aria-label="Remove holder" className="text-[var(--text-muted)] hover:text-rose-600">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)] font-medium">
                  <td className="px-2 py-2" colSpan={3}>Fully diluted</td>
                  <td className="px-2 py-2 text-right tabular-nums">{sum.totalShares.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right tabular-nums">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Ownership donut + summary */}
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 text-center">
            <svg viewBox="0 0 120 120" width="120" height="120" className="mx-auto block" role="img" aria-label="Ownership split">
              {donutSlices.map((s) => (
                <circle key={s.id} cx={60} cy={60} r={46} fill="none" stroke={s.color} strokeWidth={18}
                  strokeDasharray={`${s.len} ${circ - s.len}`} strokeDashoffset={-s.offset} transform="rotate(-90 60 60)" />
              ))}
            </svg>
            <div className="mt-3 space-y-1 text-left text-xs">
              {(["founder", "pool", "investor"] as HolderGroup[]).map((g) => (
                <div key={g} className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{GROUP_LABEL[g]}s</span>
                  <span className="tabular-nums">{pct(g === "founder" ? sum.founderPct : g === "pool" ? sum.poolPct : sum.investorPct)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--surface-sunken)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{t("founder_ownership")}</div>
            <div className="text-2xl font-medium">{pct(sum.founderPct)}</div>
          </div>
        </section>
      </div>

      {/* Round modeler */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("model_your_round")}</h2>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={modelOn} onChange={(e) => setModelOn(e.target.checked)} />
            Include a round
          </label>
        </div>

        {modelOn && (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[var(--text-secondary)]">{t("new_investment")}</span>
                <input type="number" min={0} value={round.newInvestment} onChange={(e) => setRound((r) => ({ ...r, newInvestment: Math.max(0, Number(e.target.value) || 0) }))} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--text-secondary)]">{t("pre_money_valuation_2")}</span>
                <input type="number" min={0} value={round.preMoney} onChange={(e) => setRound((r) => ({ ...r, preMoney: Math.max(0, Number(e.target.value) || 0) }))} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm" />
              </label>
            </div>

            {dilution && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([["Post-money", money(dilution.postMoney)], ["New investor", pct(dilution.newInvestorPct)], ["Founder after", pct(sum.founderPct * (1 - dilution.newInvestorPct))]] as const).map(([l, v]) => (
                    <div key={l} className="rounded-md bg-[var(--surface-sunken)] p-2.5">
                      <div className="text-xs text-[var(--text-secondary)]">{l}</div>
                      <div className="text-base font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {dilution.rows.map((d) => (
                    <div key={d.name + d.group}>
                      <div className="mb-0.5 flex justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">{d.name}</span>
                        <span className="tabular-nums">{pct(d.pctBefore)} → <span className="font-medium">{pct(d.pctAfter)}</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                        <div className="h-full rounded-full" style={{ width: `${(d.pctAfter * 100).toFixed(1)}%`, background: d.group === "new" ? "#185FA5" : d.group === "founder" ? "#1D9E75" : d.group === "pool" ? "#9FE1CB" : "#378ADD" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--text-muted)]">Illustrative cap table and dilution based on the figures you enter. Not a valuation, an offer of securities, or investment advice.</p>
      </section>

      {preview && (
        <FounderModulePreview
          title={`${companyName} — cap table`}
          subtitle={modelOn && dilution ? "Current + modeled round · read-only" : "Current ownership · read-only"}
          onClose={() => setPreview(false)}
          footer="Illustrative cap table and dilution based on the figures you entered. Not a valuation, an offer of securities, or investment advice."
        >
          <h4 className="text-sm font-semibold text-[var(--navy)]">Ownership</h4>
          <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-3 py-2">Holder</th><th className="px-3 py-2">Group</th><th className="px-3 py-2">Class</th><th className="px-3 py-2 text-right">Shares</th><th className="px-3 py-2 text-right">FD %</th>
                </tr>
              </thead>
              <tbody>
                {sum.rows.map((row) => (
                  <tr key={row.holder.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2">{row.holder.name}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{GROUP_LABEL[row.holder.group]}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{row.holder.shareClass}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.holder.shares.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(row.pct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)] font-medium">
                  <td className="px-3 py-2" colSpan={3}>Fully diluted</td>
                  <td className="px-3 py-2 text-right tabular-nums">{sum.totalShares.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {modelOn && dilution && (
            <>
              <h4 className="mt-5 text-sm font-semibold text-[var(--navy)]">Modeled round</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([["New investment", money(round.newInvestment)], ["Post-money", money(dilution.postMoney)], ["New investor", pct(dilution.newInvestorPct)], ["Founder after", pct(sum.founderPct * (1 - dilution.newInvestorPct))]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-md border border-[var(--border-subtle)] p-2.5">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{l}</div>
                    <div className="text-base font-semibold text-[var(--navy)] tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </FounderModulePreview>
      )}
    </div>
  );
}
