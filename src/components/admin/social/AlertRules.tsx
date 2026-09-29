"use client";

import { useEffect, useState } from "react";
import { AiCmo } from "./AiCmo";

type Rule = { id: string; metric: string; direction: "up" | "down" | "behind_pace"; threshold_pct: number; grain: string; channel: string; campaign_id: string | null; enabled: boolean };

const METRICS = ["conversions", "meetings", "clicks", "outreach", "revenue", "goal_pacing"] as const;
const DIRS: { v: Rule["direction"]; label: string }[] = [{ v: "down", label: "drops" }, { v: "up", label: "rises" }, { v: "behind_pace", label: "falls behind pace" }];

export function AlertRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Omit<Rule, "id">>({ metric: "conversions", direction: "down", threshold_pct: 10, grain: "week", channel: "both", campaign_id: null, enabled: true });
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const d = await fetch("/api/admin/social/alerts").then((r) => r.json()); setRules(d.rules ?? []); } catch { setRules([]); }
  }
  useEffect(() => {
    let live = true;
    fetch("/api/admin/social/alerts").then((r) => r.json()).then((d) => { if (live) setRules(d.rules ?? []); }).catch(() => { if (live) setRules([]); });
    return () => { live = false; };
  }, []);

  async function add() {
    setBusy(true);
    await fetch("/api/admin/social/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }).catch(() => {});
    setBusy(false); void load();
  }
  async function remove(id: string) {
    setBusy(true);
    await fetch("/api/admin/social/alerts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    setBusy(false); void load();
  }
  async function toggle(r: Rule) {
    setBusy(true);
    await fetch("/api/admin/social/alerts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, enabled: !r.enabled }) }).catch(() => {});
    setBusy(false); void load();
  }

  const dirLabel = (d: Rule["direction"]) => DIRS.find((x) => x.v === d)?.label ?? d;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="mb-2 text-[12.5px] font-semibold text-slate-800">Alert me when a metric moves</div>
        <div className="divide-y divide-slate-100">
          {rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-[11.5px]">
              <span className="font-medium capitalize text-slate-700">{r.metric.replace("_", " ")}</span>
              <span className={`rounded px-2 py-0.5 ${r.direction === "up" ? "bg-emerald-50 text-emerald-700" : r.direction === "down" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{dirLabel(r.direction)}</span>
              <span className="rounded border border-slate-200 px-2 py-0.5 text-slate-600">{r.direction === "behind_pace" ? `< ${r.threshold_pct}% of pace` : `≥ ${r.threshold_pct}% ${r.grain}/${r.grain}`}</span>
              <span className="text-slate-500">via {r.channel === "both" ? "email + in-app" : r.channel.replace("_", "-")}</span>
              <span className="ml-auto flex items-center gap-2">
                <button type="button" disabled={busy} onClick={() => void toggle(r)} className={`rounded px-2 py-0.5 text-[10.5px] ${r.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{r.enabled ? "On" : "Off"}</button>
                <button type="button" disabled={busy} onClick={() => void remove(r.id)} className="text-slate-400 hover:text-rose-600">✕</button>
              </span>
            </div>
          ))}
          {!rules.length ? <div className="py-2 text-[11.5px] text-slate-400">No rules yet — add one below.</div> : null}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <select value={draft.metric} onChange={(e) => setDraft((p) => ({ ...p, metric: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]">
            {METRICS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select>
          <select value={draft.direction} onChange={(e) => setDraft((p) => ({ ...p, direction: e.target.value as Rule["direction"] }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]">
            {DIRS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <input inputMode="numeric" value={String(draft.threshold_pct)} onChange={(e) => setDraft((p) => ({ ...p, threshold_pct: Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0) }))} className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]" />
            <span className="text-[11px] text-slate-500">%</span>
          </div>
          <select value={draft.grain} onChange={(e) => setDraft((p) => ({ ...p, grain: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]">
            {["week", "month", "quarter", "year"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={draft.channel} onChange={(e) => setDraft((p) => ({ ...p, channel: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]">
            <option value="in_app">in-app</option><option value="email">email</option><option value="both">email + in-app</option>
          </select>
          <button type="button" disabled={busy} onClick={() => void add()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">＋ Add rule</button>
        </div>
        <div className="mt-2 text-[10.5px] text-slate-400">Checked when the queue runs (every 5 min) and at each period close.</div>
      </div>

      <AiCmo tab="Settings · Alerts" context={() => ({ ruleCount: rules.length, metrics: rules.map((r) => r.metric) })} />
    </div>
  );
}
