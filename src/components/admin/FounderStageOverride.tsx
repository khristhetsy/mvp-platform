"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Route, Loader2, Check, RefreshCw } from "lucide-react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

const STAGES: { value: string; label: string }[] = [
  { value: "initialize", label: "Stage 1 — Initialize" },
  { value: "qualify", label: "Stage 2 — Qualify" },
  { value: "deploy", label: "Stage 3 — Deploy" },
  { value: "optimize", label: "Stage 4 — Optimize" },
];

/**
 * Admin override to set a founder's journey stage directly (advance or roll
 * back). Bypasses the normal readiness gate, so it confirms, requires a reason,
 * and is audit-logged server-side.
 */
export function FounderStageOverride({
  founderId,
  founderName,
}: Readonly<{ founderId: string; founderName?: string | null }>) {
  const t = useTranslations("adminCmp");
  const [current, setCurrent] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const recompute = useCallback(async () => {
    setRecomputing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stage-review/${founderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recompute" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not recompute.");
      const newStage = data.profile?.journey_stage ?? current;
      setCurrent(newStage);
      setStage(newStage);
      setMsg({
        text: newStage && newStage !== current
          ? `Advanced to ${STAGES.find((s) => s.value === newStage)?.label ?? newStage}.`
          : "Recomputed — the founder doesn't meet the next stage's requirements yet.",
        ok: true,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not recompute.", ok: false });
    } finally {
      setRecomputing(false);
    }
  }, [founderId, current]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/stage-review/${founderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setCurrent(data.journey_stage ?? null);
        setStage(data.journey_stage ?? "");
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [founderId]);

  const apply = useCallback(async () => {
    if (!stage || stage === current) return;
    const label = STAGES.find((s) => s.value === stage)?.label ?? stage;
    const ok = await confirmDialog({
      title: "Override journey stage?",
      message: `Set ${founderName ?? "this founder"} to ${label}? This bypasses the normal readiness gate and is recorded in the audit log.`,
      confirmLabel: "Set stage",
      danger: stage === "deploy" || stage === "optimize",
    });
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stage-review/${founderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", stage, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update stage.");
      setCurrent(data.profile?.journey_stage ?? stage);
      setMsg({ text: "Stage updated. The founder has been notified.", ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not update stage.", ok: false });
    } finally {
      setSaving(false);
    }
  }, [stage, current, reason, founderId, founderName]);

  return (
    <section className="mt-6 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="mb-3 flex items-center gap-2">
        <Route className="h-5 w-5 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-950">{t("journey_stage_override")}</p>
          <p className="text-xs text-slate-500">{t("force_advance_or_roll_back_this_founder_s_st")}</p>
        </div>
        {current ? <span className="ml-auto rounded-full bg-[#EEEDFE] px-2.5 py-0.5 text-[11px] font-medium text-[#1A6CE4]">Current: {STAGES.find((s) => s.value === current)?.label ?? current}</span> : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">
          Set stage
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 focus:border-[#2E78F5] focus:outline-none">
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs text-slate-500" style={{ minWidth: 200 }}>
          Reason (recorded)
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("why_are_you_overriding")} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2E78F5] focus:outline-none" />
        </label>
        <button type="button" disabled={saving || !stage || stage === current} onClick={() => void apply()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saving ? "Saving…" : "Set stage"}
        </button>
        <button type="button" disabled={recomputing} onClick={() => void recompute()} title={t("re_run_the_advancement_rules_using_the_found")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {recomputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {recomputing ? "Recomputing…" : "Recompute"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Recompute applies the normal rules to the founder&rsquo;s current data — it promotes them only if they actually qualify (no override).</p>

      {msg ? <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p> : null}
    </section>
  );
}
