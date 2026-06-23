"use client";

import { useCallback, useEffect, useState } from "react";
import { Route, Loader2, Check } from "lucide-react";
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
  const [current, setCurrent] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
          <p className="text-sm font-semibold text-slate-950">Journey stage override</p>
          <p className="text-xs text-slate-500">Force-advance or roll back this founder&rsquo;s stage. Bypasses readiness; audit-logged.</p>
        </div>
        {current ? <span className="ml-auto rounded-full bg-[#EEEDFE] px-2.5 py-0.5 text-[11px] font-medium text-[#3C3489]">Current: {STAGES.find((s) => s.value === current)?.label ?? current}</span> : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">
          Set stage
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 focus:border-[#534AB7] focus:outline-none">
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs text-slate-500" style={{ minWidth: 200 }}>
          Reason (recorded)
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you overriding?" className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#534AB7] focus:outline-none" />
        </label>
        <button type="button" disabled={saving || !stage || stage === current} onClick={() => void apply()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saving ? "Saving…" : "Set stage"}
        </button>
      </div>

      {msg ? <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p> : null}
    </section>
  );
}
